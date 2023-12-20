import {
    Field,
    Poseidon,
    SmartContract,
    State,
    method,
    state,
    PrivateKey,
    Reducer,
    Struct,
    PublicKey,
    MerkleWitness,
    ZkProgram,
    Gadgets,
    UInt64
} from 'o1js';
import { UInt240 } from "./int.js";
import {
    CalculateScore
} from './ExaminaRecursion.js';

export class MerkleWitnessClass extends MerkleWitness(20) {}

await CalculateScore.compile();

class CalculateProof extends ZkProgram.Proof(CalculateScore) {}

export class UserAnswers extends Struct({
    publicKey: PublicKey,
    answers: Field,
    witness: MerkleWitnessClass
}) {
    constructor (publicKey: PublicKey, answers: Field, witness: MerkleWitnessClass) {
        super({publicKey, answers, witness});
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
    constructor (secureHash: Field, answers: Field, userAnswers: Field, index: Field) {
        super({secureHash, answers, userAnswers, index});
        this.secureHash = secureHash;
        this.answers = answers;
        this.userAnswers = userAnswers;
        this.index = index;
    }

    hash() {
        return Poseidon.hash([this.answers, this.userAnswers, this.index]);
    }
}

const 
    SHIFT_RATIO = 0,
    SHIFT_DURATIONS = 4,
    MASK_RATIO = Field(15),
    MASK_DURATIONS = Field(33554431n),
    NUM_BITS = 64
;

export class Examina extends SmartContract {
    reducer = Reducer({ actionType: UserAnswers });

    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) usersRoot = State<Field>();
    @state(Field) actionState = State<Field>();
    @state(Field) examSecretKey = State<Field>();
    @state(Field) informations = State<Field>();
    @state(UInt64) startDate = State<UInt64>();

    init() {
        super.init();
        this.actionState.set(Reducer.initialActionState);

        this.requireSignature();
    }

    @method initState(
        answers: Field,
        secretKey: Field,
        hashed_questions: Field,
        usersInitialRoot: Field,
        informations: Field,
        startDate: UInt64,
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]));
        this.hashedQuestions.set(hashed_questions);
        this.usersRoot.set(usersInitialRoot);
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));

        this.informations.set(informations);
        this.startDate.set(startDate)
    }

    @method checkIsOver() {
        const informations = this.informations.getAndAssertEquals();

        const startDate = this.startDate.getAndAssertEquals()

        const shifted = Gadgets.rightShift(informations, SHIFT_DURATIONS);
        const durations = Gadgets.and(shifted, MASK_DURATIONS, 32);

        const endDate = startDate.add(UInt64.from(durations))

        const timestamps = this.network.timestamp.getAndAssertEquals()

        timestamps.assertGreaterThanOrEqual(endDate)
    }

    @method getRatio(): Field {
        const informations = this.informations.getAndAssertEquals();

        const shifted = Gadgets.rightShift(informations, SHIFT_RATIO);
        const ratio = Gadgets.and(shifted, MASK_RATIO, 3);

        return ratio;
    }

    @method submitAnswers(privateKey: PrivateKey, answers: Field, witness: MerkleWitnessClass) {
        const informations = this.informations.getAndAssertEquals();

        const startDate = this.startDate.getAndAssertEquals();

        const infos = informations.toBits();
        
        const durations = MASK_DURATIONS.toBits(25).map((x, i) => {
            return x.and(infos[i + 4]);
        });

        const endDate = startDate.add(UInt64.from(Field.fromBits(durations)));

        this.network.timestamp.assertBetween(startDate, endDate)

        const user = new UserAnswers(privateKey.toPublicKey(), answers, witness);

        this.reducer.dispatch(user);
    }

    @method publishAnswers(answers: Field, secretKey: Field) {
        this.checkIsOver();

        const initalAnswers = this.answers.getAndAssertEquals();

        const hashedAnswers = Poseidon.hash([answers, secretKey]);
        initalAnswers.assertEquals(hashedAnswers);

        const usersRoot = this.usersRoot.getAndAssertEquals();
        const actionState = this.actionState.getAndAssertEquals();

        let pendingActions = this.reducer.getActions({
            fromActionState: actionState,
        })

        let { state: newRoot, actionState: newActionState } =
        this.reducer.reduce(
            pendingActions,
            Field,
            (_state: Field, action: UserAnswers) => {
                const hash = action.hash();

                return action.witness.calculateRoot(hash);
            },
            { state: usersRoot, actionState }
        )

        this.usersRoot.set(newRoot);
        this.actionState.set(newActionState);

        this.answers.set(answers);
        this.examSecretKey.set(secretKey);
    }

    @method verifyQuestions(hashedExam: Field) {
        const hash = this.hashedQuestions.getAndAssertEquals();
        
        return hash.equals(hashedExam);
    }

    @method checkScore(proof: CalculateProof, witness: MerkleWitnessClass, privateKey: PrivateKey, controller: Controller) {
        this.checkIsOver();
        
        proof.verify();

        const usersRoot = this.usersRoot.getAndAssertEquals();
        const answers = this.answers.getAndAssertEquals();
        const incorrectToCorrectRatio = this.getRatio();

        const secureHash = controller.secureHash;
        proof.publicInput.assertEquals(secureHash);

        secureHash.assertEquals(controller.hash());

        answers.assertEquals(controller.answers);
        
        const witnessRoot = witness.calculateRoot(Poseidon.hash(privateKey.toPublicKey().toFields().concat(controller.userAnswers)));
        usersRoot.assertEquals(witnessRoot);

        const incorrects = proof.publicOutput.incorrects;
        const corrects = proof.publicOutput.corrects;
;
        const quotient = incorrects.div(UInt240.from(incorrectToCorrectRatio));

        const score = corrects.sub(quotient);

        return score;
    }
}