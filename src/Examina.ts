import {
  Bool,
  Field,
  MerkleMapWitness,
  Poseidon,
  Proof,
  SmartContract,
  State,
  method,
  state,
} from 'o1js';

export class ScoreProof extends Proof<Field, Field> {}

export class Examina extends SmartContract {
  events = {
      ScoreChecked: Field,
  };

  @state(Field) answers = State<Field>();
  @state(Field) hashedQuestions = State<Field>();
  @state(Field) userScores = State<Field>();
  @state(Field) isOver = State<Field>();

  @method initState(
      answers: Field,
      salt: Field,
      question_root: Field,
      scores_root: Field
  ) {
      super.init();
      this.answers.set(Poseidon.hash([answers, salt]));
      this.hashedQuestions.set(question_root);
      this.isOver.set(Bool(false).toField());
      this.userScores.set(scores_root);
  }

  @method publishAnswers(answers: Field, salt: Field) {
      const is_over = this.isOver.get();
      this.isOver.assertEquals(is_over);

      is_over.assertEquals(Bool(false).toField());

      const root = this.answers.get();
      this.answers.assertEquals(root);

      const hashed_answers = Poseidon.hash([answers, salt]);
      this.answers.assertEquals(hashed_answers);

      this.answers.set(answers);
this.isOver.set(Bool(true).toField());
  }

  @method checkQuestions(exam: Field) {
      const hash = this.hashedQuestions.get();
      this.hashedQuestions.assertEquals(hash);

      this.hashedQuestions.assertEquals(exam);
  }

  @method submitAnswers(
      witness: MerkleMapWitness,
      publicKey: Field,
      answer: Field
  ) {
      const is_over = this.isOver.get();
      this.isOver.assertEquals(is_over);

      const user_scores = this.userScores.get();
      this.userScores.assertEquals(user_scores);

      is_over.assertEquals(Bool(false).toField());

      const [before_root, key] = witness.computeRootAndKey(Field(0));
      this.userScores.assertEquals(before_root);

      key.assertEquals(publicKey);

      const [new_root] = witness.computeRootAndKey(answer);
      this.userScores.set(new_root);
  }

  @method checkScore(proof: ScoreProof) {
      proof.verify();

      const is_over = this.isOver.get();
      this.isOver.assertEquals(is_over);

      is_over.assertEquals(Bool(true).toField());

      const user_scores = this.userScores.get();
      this.userScores.assertEquals(user_scores);

      const score = proof.publicOutput;

      this.emitEvent('ScoreChecked', score);
  }
}