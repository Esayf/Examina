import { Examina, MerkleWitnessClass } from './Examina.js';
import { CalculateScore } from './ExaminaRecursion.js'
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

const answers = Field(12345)
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
  zkapp.submitAnswers(pk, Field(12345), new MerkleWitnessClass(merkleMap.getWitness(1n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(1n, Poseidon.hash(pk.toPublicKey().toFields().concat(Field(12345))))

console.log('action 2');
const pk1 = PrivateKey.random()

tx = await Mina.transaction(feePayer, () => {
  zkapp.submitAnswers(pk1, Field(55555), new MerkleWitnessClass(merkleMap.getWitness(2n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(2n, Poseidon.hash(pk1.toPublicKey().toFields().concat(Field(55555))))

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

console.log(new MerkleWitnessClass(merkleMap.getWitness(1n)).calculateRoot(Poseidon.hash(pk.toPublicKey().toFields().concat(Field(12345)))))