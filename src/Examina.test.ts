import { Controller, Examina, MerkleWitnessClass } from './Examina';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree, Poseidon, Bool, UInt64 } from 'o1js';
import { CalculateScore } from './ExaminaRecursion';
import { UInt240 } from './int';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = true;

let testAccounts: {
    publicKey: PublicKey;
    privateKey: PrivateKey;
}[]; // Test Accounts
let users: Field[] = []
let merkleTree: MerkleTree
let answers: Field
let informations: Field
let examKey: Field
let questions: Field = Field(0)
const userAnswers = Field(235n)
let user2Answers: Field
let user1Answers: Field
let index = Field(1).div(10)

let pk: PrivateKey
let pk1: PrivateKey



describe("Examina", () => {
    let deployerKey: PrivateKey,
        deployerAccount: PublicKey,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkAppInstance: Examina
    
    function createUserAnswersField(answers_array: number[]) {
        let answersInBoolens: Bool[] = []

        for (const answer of answers_array) {
            answersInBoolens = answersInBoolens.concat(Field(answer).toBits(3)) 
        }
        return Field.fromBits(answersInBoolens)
    }

    function createLocalBlockchain() {
            const Local = Mina.LocalBlockchain({ proofsEnabled: proofsEnabled });
            Mina.setActiveInstance(Local);
            testAccounts = Local.testAccounts;
        
            return Local.testAccounts[0]
        };
    beforeAll(async () => {
        ({ privateKey: deployerKey, publicKey: deployerAccount } = createLocalBlockchain())
        zkAppPrivateKey = PrivateKey.random()
        zkAppAddress = zkAppPrivateKey.toPublicKey()
        zkAppInstance = new Examina(zkAppAddress)
        if (proofsEnabled) { await Examina.compile() }


        const txn = await Mina.transaction(deployerAccount, () => {
            AccountUpdate.fundNewAccount(deployerAccount)

            merkleTree = new MerkleTree(20)

            zkAppInstance.deploy()
        })

        await txn.prove()
        await txn.sign([deployerKey, zkAppPrivateKey]).send()

        const json_questions = {
            "questions": [
                {
                    "questionText": "Which of the following options is a blockchain based on zero-knowledge proof?",
                    "options": [
                        "Ethereum",
                        "Bitcoin",
                        "Mina",
                        "Chainlink",
                        "Polygon"
                    ],
                },
                {
                    "questionText": "What type of library is React.js?",
                    "options": [
                        "CSS Framework",
                        "JavaScript Library",
                        "Server-side Framework",
                        "Database Management System",
                        "Testing Library"
                    ],
                },
                {
                    "questionText": "Which programming language does Mina protocol use?",
                    "options": [
                        "Python",
                        "JavaScript",
                        "C#",
                        "C++",
                        "TypeScript"
                    ]
                }
            ]
        }          

        for (const question of json_questions.questions) {
            const buffer = Buffer.from(JSON.stringify(question), "utf-8")
            const q = Field(BigInt("0x" + buffer.toString("hex")))

            questions = Poseidon.hash([q, questions])
        }

        const answers_array = [3, 2, 5]
        let answers_in_booleans: Bool[] = []

        for (const answer of answers_array) {
            answers_in_booleans = answers_in_booleans.concat(Field(answer).toBits(3)) 
        }

        answers = Field(325)


        user1Answers = createUserAnswersField([3, 2, 5])
        user2Answers = Field(325)

        
        informations = Field(57601n)
        examKey = Field.random()
    })
    
    it("generates and deploys the `Examina` smart contract (create an exam)", async () => {
        const txn = await Mina.transaction(deployerAccount, () => {
            zkAppInstance.initState(answers, examKey, questions, merkleTree.getRoot(), Field(1), Field(16), Field(536870912))
        })

        await txn.prove()
        await txn.sign([deployerKey]).send()

        expect(zkAppInstance.answers.get()).toEqual(Poseidon.hash([answers, examKey]))
        expect(zkAppInstance.examSecretKey.get()).toEqual(Poseidon.hash(examKey.toFields()))
        // expect(zkAppInstance.isOver.get()).toEqual(Bool(false).toField())
        expect(zkAppInstance.hashedQuestions.get()).toEqual(questions)
        expect(zkAppInstance.usersRoot.get()).toEqual(merkleTree.getRoot())
    })

    it("submit answers for users and publish answers", async () => {
        console.log('action 1');
        pk = PrivateKey.random()

        let txn = await Mina.transaction(deployerAccount, () => {
            zkAppInstance.submitAnswers(pk, user1Answers, new MerkleWitnessClass(merkleTree.getWitness(1n))); // 237 => 011 101 101 : 3, 5, 5
        });
        await txn.prove();
        await txn.sign([deployerKey]).send();

        merkleTree.setLeaf(1n, Poseidon.hash(pk.toPublicKey().toFields().concat(user1Answers)))

        console.log('action 2');
        pk1 = PrivateKey.random()

        txn = await Mina.transaction(deployerAccount, () => {
            zkAppInstance.submitAnswers(pk1, user2Answers, new MerkleWitnessClass(merkleTree.getWitness(2n))); // 213 => 010 101 101 : 3, 5, 5
        });
        await txn.prove();
        await txn.sign([deployerKey]).send();

        merkleTree.setLeaf(2n, Poseidon.hash(pk1.toPublicKey().toFields().concat(user2Answers)))

        txn = await Mina.transaction(deployerAccount, () => {
            zkAppInstance.publishAnswers(answers, examKey);
        });
        await txn.prove()
        await txn.sign([deployerKey]).send();

        // expect(zkAppInstance.isOver.get()).toEqual(Bool(true).toField())
        expect(zkAppInstance.answers.get()).toEqual(answers)
        expect(zkAppInstance.examSecretKey.get()).toEqual(examKey)
    })

     it("calculate score", async () => {
        let secureHash = Poseidon.hash([answers, user2Answers, index])

        let proof = await CalculateScore.baseCase(secureHash, answers, user2Answers, index)
        let publicOutputs = proof.publicOutput
        console.log("starting recursion score:", publicOutputs.corrects.toString())

        for (let i = 0; i < 3; i++) {
            index = index.mul(10)
            secureHash = Poseidon.hash([answers, user2Answers, index])

            proof = await CalculateScore.calculate(secureHash, proof, answers, user2Answers, index)
            publicOutputs = proof.publicOutput
            
            console.log("recursion score:", publicOutputs.corrects.toString())
        }
        expect(publicOutputs.corrects).toEqual(UInt240.from(3))
        expect(publicOutputs.incorrects).toEqual(UInt240.from(0))
        const controller = new Controller(proof.publicInput, answers, user2Answers, index)

        let result_score: UInt240 = UInt240.from(0)

        let txn = await Mina.transaction(deployerAccount, () => {
            result_score = zkAppInstance.checkScore(proof, pk1, controller);
        });
        await txn.prove();
        await txn.sign([deployerKey]).send();
        
        
        expect(result_score).toEqual(UInt240.from(3))
    }) 
})

