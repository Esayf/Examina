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
    UInt64,
    Provable,
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
    SHIFT_RATIO = 1,
    SHIFT_DURATIONS = 16,
    SHIFT_STARTDATE = 536870912,
    MASK_RATIO = Field(15),
    MASK_DURATIONS = Field(33554431n),
    MASK_STARTDATE = Field(18446744073709551615n),
    NUM_BITS = 240
;

export class Examina extends SmartContract {
    reducer = Reducer({ actionType: UserAnswers });

    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) usersRoot = State<Field>();
    @state(Field) actionState = State<Field>();
    @state(Field) examSecretKey = State<Field>();
    @state(Field) informations = State<Field>();

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
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]));
        this.hashedQuestions.set(hashed_questions);
        this.usersRoot.set(usersInitialRoot);
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));

        this.informations.set(informations); // 4 bit => ratio, 25 bit => durations, 64 bit => startDate
    }

    @method getRatio(): Field {
        const informations = this.informations.getAndRequireEquals();
        const convertedInformations = UInt240.from(informations);

        const shifted = convertedInformations.div(SHIFT_RATIO).toField();
        const ratio = Gadgets.and(shifted, MASK_RATIO, NUM_BITS);

        return ratio;
    }

    @method getDurations(): Field {
        const informations = this.informations.getAndRequireEquals();
        const convertedInformations = UInt240.from(informations);

        const shifted = convertedInformations.div(SHIFT_DURATIONS).toField();
        const durations = Gadgets.and(shifted, MASK_DURATIONS, NUM_BITS);

        return durations.mul(1000);
    }

    @method getStartDate(): Field {
        const informations = this.informations.getAndRequireEquals();
        const convertedInformations = UInt240.from(informations);

        const shifted = convertedInformations.div(SHIFT_STARTDATE).toField();
        const startDate = Gadgets.and(shifted, MASK_STARTDATE, NUM_BITS);

        return startDate;
    }

    @method checkIsOver() {
        const durations = UInt64.from(this.getDurations())
        const startDate = UInt64.from(this.getStartDate())
        const endDate = startDate.add(durations)

        const timestamps = this.network.timestamp.getAndRequireEquals()

        timestamps.assertGreaterThanOrEqual(endDate)
    }

    @method checkIsContinue() {
        const durations = UInt64.from(this.getDurations())
        const startDate = UInt64.from(this.getStartDate())
        const endDate = startDate.add(durations)

        this.network.timestamp.requireBetween(startDate, endDate)
    }

    @method submitAnswers(privateKey: PrivateKey, answers: Field, witness: MerkleWitnessClass) {
        this.checkIsContinue()

        const user = new UserAnswers(privateKey.toPublicKey(), answers, witness);

        this.reducer.dispatch(user);
    }

    @method publishAnswers(answers: Field, secretKey: Field) {
        this.checkIsOver();

        const initalAnswers = this.answers.getAndRequireEquals();

        const hashedAnswers = Poseidon.hash([answers, secretKey]);
        initalAnswers.assertEquals(hashedAnswers);

        const usersRoot = this.usersRoot.getAndRequireEquals();
        const actionState = this.actionState.getAndRequireEquals();

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
        const hash = this.hashedQuestions.getAndRequireEquals();
        
        return hash.equals(hashedExam);
    }

    @method checkScore(proof: CalculateProof, witness: MerkleWitnessClass, privateKey: PrivateKey, controller: Controller) {
        this.checkIsOver();
        
        proof.verify();

        const usersRoot = this.usersRoot.getAndRequireEquals();
        const answers = this.answers.getAndRequireEquals();
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