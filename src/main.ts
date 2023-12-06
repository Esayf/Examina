import { Examina, MerkleWitnessClass, Controller } from './Examina.js';
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
  Bool,
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

const answers = Field(173n)
const userAnswers = Field(237n)
let index = Field(-3)
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
  zkapp.submitAnswers(pk, Field(237n), new MerkleWitnessClass(merkleMap.getWitness(1n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(1n, Poseidon.hash(pk.toPublicKey().toFields().concat(Field(237n))))

console.log('action 2');
const pk1 = PrivateKey.random()

tx = await Mina.transaction(feePayer, () => {
  zkapp.submitAnswers(pk1, Field(237n), new MerkleWitnessClass(merkleMap.getWitness(2n)));
});
await tx.prove();
await tx.sign([feePayerKey]).send();

merkleMap.setLeaf(2n, Poseidon.hash(pk1.toPublicKey().toFields().concat(Field(237n))))

console.log('rolling up pending actions..');

console.log('state before: ' + zkapp.usersRoot.get());

tx = await Mina.transaction(feePayer, () => {
  zkapp.publishAnswers(answers, secretKey);
});
await tx.prove()
await tx.sign([feePayerKey]).send();

console.log('state after rollup: ' + zkapp.usersRoot.get());

console.log("answers:", zkapp.answers.get().toString())
console.log("isOver:", zkapp.isOver.get().toString())
console.log("examKey:", zkapp.examSecretKey.get().toString())

console.log("1n user merkle witness calculated root:", new MerkleWitnessClass(merkleMap.getWitness(1n)).calculateRoot(Poseidon.hash(pk.toPublicKey().toFields().concat(Field(237n)))).toString())

const bitsOfAnswers = answers.toBits()
const bitsOfUserAnswers = userAnswers.toBits()

let secureHash = Poseidon.hash([answers, userAnswers, index])

let proof = await CalculateScore.baseCase(secureHash, answers, userAnswers, index)
let score = proof.publicOutput
console.log("recursion score:", score.toString())

for (let i = 0; i < 3; i++) {
  index = index.add(3)
  secureHash = Poseidon.hash([answers, userAnswers, index])

  const i = Number(index)
                        
  const a = Field.fromBits(bitsOfAnswers.slice(i, i + 3))
  const ua = Field.fromBits(bitsOfUserAnswers.slice(i, i + 3))

  proof = await CalculateScore.step(secureHash, proof, answers, userAnswers, index, a, ua, score)
  score = proof.publicOutput
  
  console.log("recursion score:", score.toString())
}

const controller = new Controller(proof.publicInput, answers, userAnswers, index)

let result_score = Field(0)

tx = await Mina.transaction(feePayer, () => {
  result_score = zkapp.checkScore(proof, new MerkleWitnessClass(merkleMap.getWitness(2n)), pk1, controller);
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('contract score: ' +  result_score.toString());
