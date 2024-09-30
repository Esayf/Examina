import {
    Field,
    Poseidon,
    SmartContract,
    State,
    method,
    state,
    Struct,
    PublicKey,
    MerkleWitness,
    ZkProgram,
    UInt64,
    AccountUpdate,
    Permissions,
    Nullifier,
    Provable,
    MerkleMapWitness,
    MerkleMap,
    assert
} from 'o1js';
import {
    CalculateScore
} from './ExaminaRecursion.js';

export class MerkleWitnessClass extends MerkleWitness(20) { }

await CalculateScore.compile();

class CalculateProof extends ZkProgram.Proof(CalculateScore) { }

export class UserAnswers extends Struct({
    publicKey: PublicKey,
    answers: Field,
    witness: MerkleWitnessClass
}) {
    constructor(publicKey: PublicKey, answers: Field, witness: MerkleWitnessClass) {
        super({ publicKey, answers, witness });
        this.publicKey = publicKey;
        this.answers = answers;
        this.witness = witness;
    }

    hash() {
        return Poseidon.hash(this.publicKey.toFields().concat(this.answers));
    }
}

export class Controller extends Struct({
    secureHash: Field,
    answers: Field,
    userAnswers: Field,
    index: Field,
}) {
    constructor(secureHash: Field, answers: Field, userAnswers: Field, index: Field) {
        super({ secureHash, answers, userAnswers, index });
        this.secureHash = secureHash;
        this.answers = answers;
        this.userAnswers = userAnswers;
        this.index = index;
    }

    hash() {
        return Poseidon.hash([this.answers, this.userAnswers, this.index]);
    }

    userAnswersHash(publicKey: PublicKey) {
        return Poseidon.hash(publicKey.toFields().concat(this.userAnswers));
    }
}

export class Examina extends SmartContract {
    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) nullifierRoot = State<Field>();
    @state(Field) nullifierExamId = State<Field>();
    @state(Field) examSecretKey = State<Field>();
    @state(Field) duration = State<UInt64>();
    @state(Field) startDate = State<UInt64>();
    @state(UInt64) rewardPerWinner = State<UInt64>();

    init() {
        super.init();
        this.requireSignature();
        this.account.permissions.set({
            ...Permissions.default(),
            send: Permissions.proofOrSignature()
        });
    }

    @method async initState(
        answers: Field,
        secretKey: Field,
        hashedQuestions: Field,
        usersInitialRoot: Field,
        duration: UInt64,
        startDate: UInt64,
        totalRewardPoolAmount: UInt64 // This is the total reward pool
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]));
        this.hashedQuestions.set(hashedQuestions);
        this.nullifierRoot.set(usersInitialRoot);
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));
        this.duration.set(duration);
        this.startDate.set(startDate);
        await this.deposit(this.sender.getAndRequireSignatureV2(), totalRewardPoolAmount);
    }

    async deposit(user: PublicKey, amount: UInt64) {
        // add your deposit logic circuit here
        // that will adjust the amount

        const payerUpdate = AccountUpdate.createSigned(user);
        payerUpdate.send({ to: this.address, amount: amount });
    }

    @method async checkIsOver() {
        const durations = this.duration.getAndRequireEquals()
        const startDate = this.startDate.getAndRequireEquals()
        const endDate = startDate.add(durations)

        const timestamps = this.network.timestamp.getAndRequireEquals()

        timestamps.assertGreaterThanOrEqual(endDate)
    }

    @method async checkIsContinue() {
        const durations = UInt64.from(this.duration.getAndRequireEquals())
        const startDate = UInt64.from(this.startDate.getAndRequireEquals())
        const endDate = startDate.add(durations)

        this.network.timestamp.requireBetween(startDate, endDate)
    }

    @method async publishAnswers(answers: Field, secretKey: Field) {
        //this.checkIsOver();

        const initalAnswers = this.answers.getAndRequireEquals();

        const hashedAnswers = Poseidon.hash([answers, secretKey]);
        initalAnswers.assertEquals(hashedAnswers);

        this.answers.set(answers);
        this.examSecretKey.set(secretKey);
    }

    @method async verifyQuestions(hashedExam: Field) {
        const hash = this.hashedQuestions.getAndRequireEquals();
        hash.equals(hashedExam);
    }

    // I want to send to 3 users at one payout call and I will call this function in batches
    // I will send the nullifier tree and the nullifier to the function to control if the three user batch used before
    @method async payoutByThree(
        nullifierTree: MerkleMap, 
        nullifier1: Nullifier, 
        nullifier2: Nullifier, 
        nullifier3: Nullifier
    ) {
        let nullifierRoot = this.nullifierRoot.getAndRequireEquals();
        let nullifierMessage = this.nullifierExamId.getAndRequireEquals();

        // verify the nullifier
        nullifier1.verify([nullifierMessage]);
        nullifier2.verify([nullifierMessage]);
        nullifier3.verify([nullifierMessage]);

        let nullifierWitness1 = Provable.witness(MerkleMapWitness, () =>
            nullifierTree.getWitness(nullifier1.key())
        );
        nullifier1.assertUnusedV2(nullifierWitness1, nullifierRoot);
        //let newRoot = nullifier1.setUsedV2(nullifierWitness1); Replicate this behaviour
        nullifierTree.set(nullifier1.key(), Field(1));
        let nullifierWitness2 = Provable.witness(MerkleMapWitness, () =>
            nullifierTree.getWitness(nullifier2.key())
        );
        nullifier2.assertUnusedV2(nullifierWitness2, nullifierRoot);
        nullifierTree.set(nullifier2.key(), Field(1));
        let nullifierWitness3 = Provable.witness(MerkleMapWitness, () =>
            nullifierTree.getWitness(nullifier3.key())
        );
        nullifier3.assertUnusedV2(nullifierWitness3, nullifierRoot);
        nullifierTree.set(nullifier3.key(), Field(1));

        // we compute the current root and make sure the entry is set to 0 (= unused)
        let updatedRootWith3Nullifier = nullifierTree.getRoot();
        // we update the on-chain root
        this.nullifierRoot.set(updatedRootWith3Nullifier);

        // we pay out a reward
        let balance = this.account.balance.getAndRequireEquals();
        const rewardPerWinner = this.rewardPerWinner.getAndRequireEquals();
        assert(balance.greaterThanOrEqual(rewardPerWinner.mul(3)), "balance must be greater than 0");
        // finally, we send the payout to the public key associated with the nullifier
        this.send({ to: nullifier1.getPublicKey(), amount:  rewardPerWinner});
        this.send({ to: nullifier2.getPublicKey(), amount:  rewardPerWinner});
        this.send({ to: nullifier3.getPublicKey(), amount:  rewardPerWinner});
    }

    async checkScore(proof: CalculateProof) {
        proof.verify();
        this.answers.getAndRequireEquals();
        return proof.publicOutput.corrects;
    }
}