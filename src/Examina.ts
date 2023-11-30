import {
    Bool,
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
    ZkProgram
} from 'o1js';
import {
    CalculateScore
} from './ExaminaRecursion.js'

await CalculateScore.compile()

class CalculateProof extends ZkProgram.Proof(CalculateScore) {}

export class MerkleWitnessClass extends MerkleWitness(20) {};

export class UserAnswers extends Struct({
    publicKey: PublicKey,
    answers: Field,
    witness: MerkleWitnessClass
}) {
    constructor (publicKey: PublicKey, answers: Field, witness: MerkleWitnessClass) {
        super({publicKey, answers, witness})
        this.publicKey = publicKey
        this.answers = answers
        this.witness = witness
    }

    hash() {
        return Poseidon.hash(this.publicKey.toFields().concat(this.answers))
    }
}

export class Examina extends SmartContract {
    reducer = Reducer({ actionType: UserAnswers });

    @state(Field) answers = State<Field>()
    @state(Field) hashedQuestions = State<Field>()
    @state(Field) usersRoot = State<Field>()
    @state(Field) isOver = State<Field>()
    @state(Field) actionState = State<Field>()
    @state(Field) examSecretKey = State<Field>()

    init() {
        super.init()
        this.actionState.set(Reducer.initialActionState)
        this.isOver.set(Bool(false).toField())

        this.requireSignature()
    }

    @method initState(
        answers: Field,
        secretKey: Field,
        hashed_questions: Field,
        usersInitialRoot: Field
    ) {
        this.answers.set(Poseidon.hash([answers, secretKey]))
        this.hashedQuestions.set(hashed_questions)
        this.usersRoot.set(usersInitialRoot)
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()))
    }

    @method submitAnswers(privateKey: PrivateKey, answers: Field, witness: MerkleWitnessClass) {
        const isOver = this.isOver.getAndAssertEquals()

        isOver.assertEquals(Bool(false).toField())

        const user = new UserAnswers(privateKey.toPublicKey(), answers, witness)

        this.reducer.dispatch(user);
    }

    @method publishAnswers(answers: Field, secretKey: Field) {
        const isOver = this.isOver.getAndAssertEquals()

        isOver.assertEquals(Bool(false).toField())

        const initalAnswers = this.answers.getAndAssertEquals()

        const hashedAnswers = Poseidon.hash([answers, secretKey])
        initalAnswers.assertEquals(hashedAnswers)

        const usersRoot = this.usersRoot.getAndAssertEquals()
        const actionState = this.actionState.getAndAssertEquals()

        this.isOver.set(Bool(true).toField())

        let pendingActions = this.reducer.getActions({
            fromActionState: actionState,
        })

        let { state: newRoot, actionState: newActionState } =
        this.reducer.reduce(
            pendingActions,
            Field,
            (_state: Field, action: UserAnswers) => {
                const hash = action.hash()

                return action.witness.calculateRoot(hash);
            },
            { state: usersRoot, actionState }
        )

        this.usersRoot.set(newRoot);
        this.actionState.set(newActionState);

        this.answers.set(answers)
        this.examSecretKey.set(secretKey)
    }

    @method verifyQuestions(exam: Field) {
        const hash = this.hashedQuestions.getAndAssertEquals()
        const hashedExam = Poseidon.hash(exam.toFields())
        
        return hash.equals(hashedExam)
    }

    @method checkScore(proof: CalculateProof) {
        proof.verify()
        
        const isOver = this.isOver.getAndAssertEquals()
        isOver.assertEquals(Bool(true).toField())

        const score = proof.publicOutput

        return score
    }
}