import {
  Bool,
  Field,
  Poseidon,
  SmartContract,
  State,
  method,
  state,
  ZkProgram,
  PrivateKey,
  Reducer,
  MerkleMap,
  Struct,
  PublicKey
} from 'o1js';
import {
  CalculateScore
} from './ExaminaRecursion.js'

await CalculateScore.compile()

class CalculateProof extends ZkProgram.Proof(CalculateScore) {}

class UserAnswers extends Struct({
    publicKey: PublicKey,
    answers: Field,
}) {
    hash() {
        return Poseidon.hash(this.publicKey.toFields())
    }
}

export class Examina extends SmartContract {
    events = {
        ScoreChecked: Field,
    };

    reducer = Reducer({ actionType: UserAnswers })

    @state(Field) answers = State<Field>();
    @state(Field) hashedQuestions = State<Field>();
    @state(Field) userAnswersRoot = State<Field>();
    @state(Field) isOver = State<Field>();
    @state(Field) actionState = State<Field>();
    @state(Field) examKey = State<Field>();

    @method initState(
        answers: Field,
        salt: Field,
        hashed_questions: Field,
        user_answers_root: Field
    ) {
        super.init();
        this.answers.set(Poseidon.hash([answers, salt]));
        this.hashedQuestions.set(hashed_questions);
        this.isOver.set(Bool(false).toField());
        this.userAnswersRoot.set(user_answers_root);
        this.examKey.set(Poseidon.hash(salt.toFields()))
    }
    
    @method submitAnswers(privateKey: PrivateKey, answers: Field) {
        const is_over = this.isOver.getAndAssertEquals()

        is_over.assertEquals(Bool(false).toField())
        
        const userAnswers = new UserAnswers({
            publicKey: privateKey.toPublicKey(),
            answers: answers
        })

        this.reducer.dispatch(userAnswers)
    }

    @method publishAnswers(answers: Field, salt: Field) {
        const is_over = this.isOver.getAndAssertEquals()

        is_over.assertEquals(Bool(false).toField());

        const initial_answers = this.answers.getAndAssertEquals()

        const hashed_answers = Poseidon.hash([answers, salt]);
        initial_answers.assertEquals(hashed_answers);

        const user_answers = this.userAnswersRoot.getAndAssertEquals()

        const merkleMap = new MerkleMap()
        
        const actionState = this.actionState.getAndAssertEquals()

        const pendingActions = this.reducer.getActions({
            fromActionState: actionState,
        });

        let { state: newRoot, actionState: newActionState } = this.reducer.reduce(
            pendingActions,
            Field,
            (state: Field, action: UserAnswers) => {
                merkleMap.set(action.hash(), action.answers)
                return merkleMap.getRoot()
            },
            { state: user_answers, actionState }
        );

        this.userAnswersRoot.set(newRoot);
        this.actionState.set(newActionState);

        this.answers.set(answers);
        this.examKey.set(salt)
        this.isOver.set(Bool(true).toField());
        
        return merkleMap
    }

    @method checkQuestions(exam: Field) {
        const hash = this.hashedQuestions.getAndAssertEquals()

        return hash.equals(exam)
    }

    @method checkScore(proof: CalculateProof) {
        proof.verify();

        const is_over = this.isOver.getAndAssertEquals()

        is_over.assertEquals(Bool(true).toField());

        const score = proof.publicOutput;

        return score
    }
}