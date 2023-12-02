import { Examina, MerkleWitnessClass } from './Examina.js';
import { CalculateScore, PublicInputs } from './ExaminaRecursion.js'
import {
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
  Reducer,
  MerkleTree,
} from 'o1js';


const merkleMap = new MerkleTree(20)

const doProofs = true;
const initialRoot = merkleMap.getRoot();

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

// a test account that pays all the fees, and puts additional funds into the zkapp
let feePayerKey = Local.testAccounts[0].privateKey;
let feePayer = Local.testAccounts[0].publicKey;

// the zkapp account
let zkappKey = PrivateKey.fromBase58(
  'EKEQc95PPQZnMY9d9p1vq1MWLeDJKtvKj4V75UDG3rjnf32BerWD'
);
let zkappAddress = zkappKey.toPublicKey();
let zkapp = new Examina(zkappAddress);
if (doProofs) {
  console.log('compile');
  await Examina.compile();
} else {
  // TODO: if we don't do this, then `analyzeMethods()` will be called during `runUnchecked()` in the tx callback below,
  // which currently fails due to `finalize_is_running` in snarky not resetting internal state, and instead setting is_running unconditionally to false,
  // so we can't nest different snarky circuit runners
  Examina.analyzeMethods();
}

console.log('deploy');

let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer);
  zkapp.deploy();
});
await tx.prove()
await tx.sign([feePayerKey, zkappKey]).send();

console.log('create exam');

const answers = Field(21835n)
const secretKey = Field.random()

console.log("secret key: ", secretKey.toString())

tx = await Mina.transaction(feePayer, () => {
  zkapp.initState(answers, secretKey, Field(12345678910), initialRoot)
});
await tx.prove()
await tx.sign([feePayerKey, zkappKey]).send();

console.log('applying actions..');

console.log('action 1');

const pk = PrivateKey.random()

tx = await Mina.transaction(feePayer, () => {
  zkapp.submitAnswers(pk, Field(13643n), new MerkleWitnessClass(merkleMap.getWitness(1n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(1n, Poseidon.hash(pk.toPublicKey().toFields().concat(Field(13643n))))

console.log('action 2');
const pk1 = PrivateKey.random()

tx = await Mina.transaction(feePayer, () => {
  zkapp.submitAnswers(pk1, Field(13643n), new MerkleWitnessClass(merkleMap.getWitness(2n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(2n, Poseidon.hash(pk1.toPublicKey().toFields().concat(Field(13643n))))

console.log('rolling up pending actions..');

console.log('state before: ' + zkapp.usersRoot.get());

tx = await Mina.transaction(feePayer, () => {
  zkapp.publishAnswers(answers, secretKey);
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('state after rollup: ' + zkapp.usersRoot.get());

console.log("answers:", zkapp.answers.get())
console.log("isOver:", zkapp.isOver.get())
console.log("examKey:", zkapp.examSecretKey.get())

console.log(new MerkleWitnessClass(merkleMap.getWitness(1n)).calculateRoot(Poseidon.hash(pk.toPublicKey().toFields().concat(Field(13643n)))))

let publicInputs = new PublicInputs({
  userAnswers: Field(13643n),
  answers: Field(21835n),
  index: Field(-3),
})

const proof0 = await CalculateScore.baseCase(publicInputs)
console.log(proof0.publicInput.index, proof0.publicOutput)

publicInputs = publicInputs.updateIndex()

const proof1 = await CalculateScore.step(publicInputs, proof0, Field(0))
console.log(proof1.publicInput, proof1.publicOutput)

publicInputs = publicInputs.updateIndex()

const proof2 = await CalculateScore.step(publicInputs, proof1, Field(1))
console.log(proof2.publicInput, proof2.publicOutput)

let score

tx = await Mina.transaction(feePayer, () => {
score = zkapp.checkScore(proof2, new MerkleWitnessClass(merkleMap.getWitness(2n)), pk1);
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('score: ' +  score);