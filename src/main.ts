import { Examina } from './Examina.js';
import { CalculateScore } from './ExaminaRecursion.js'
import {
  Field,
  Mina,
  PrivateKey,
  AccountUpdate,
  MerkleMap,
  Poseidon,
} from 'o1js';

const useProof = false;
const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);

const { privateKey: deployerKey, publicKey: deployerAccount } = Local.testAccounts[0];
const { privateKey: senderKey, publicKey: senderAccount } = Local.testAccounts[1];

// ----------------------------------------------------
// Create a public/private key pair. The public key is your address and where you deploy the zkApp to
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
// create an instance of Square - and deploy it to zkAppAddress

const zkAppInstance = new Examina(zkAppAddress);
const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkAppInstance.deploy();
});
await deployTxn.sign([deployerKey, zkAppPrivateKey]).send();
// get the initial state of Square after deployment
const num0 = zkAppInstance.answers.get();
console.log('state after init:', num0.toString());

const map = new MerkleMap()
map.set(Field(0), Field(1010101010))

const answers = Field(123012301241230)
const salt = Field.random()

console.log("salt: ", salt)

const questions = Field("12345")
const hash = Poseidon.hash(questions.toFields())

// ----------------------------------------------------
const txn1 = await Mina.transaction(senderAccount, () => {
  zkAppInstance.initState(answers, salt, hash, map.getRoot());
});
await txn1.prove();
await txn1.sign([senderKey]).send();
const num1 = zkAppInstance.answers.get();
console.log('state after txn1:', num1.toString());

const { verificationKey } = await CalculateScore.compile();

var proof = await CalculateScore.baseCase(Field(1));
var x = Field(10)
var score = Field(0)

for (let index = 0; index < 3; index++) {
  console.log("x main.ts: ", x.toString())
  
  const proof1 = await CalculateScore.step(x, proof, Field(2333355), Field(1000050), score);
  proof = proof1

  x = x.mul(10)
  score = proof.publicOutput

  console.log(score.toString())
}

/*

*/