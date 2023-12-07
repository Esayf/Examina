import { Examina } from './Examina';
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree, Poseidon, Bool } from 'o1js';

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
let examKey: Field
let questions: Field = Field(0)

function createLocalBlockchain() {
    const Local = Mina.LocalBlockchain({ proofsEnabled: proofsEnabled });
    Mina.setActiveInstance(Local);
    testAccounts = Local.testAccounts;

    return Local.testAccounts[0]
};

describe("Examina", () => {
    let deployerKey: PrivateKey,
        deployerAccount: PublicKey,
        zkAppAddress: PublicKey,
        zkAppPrivateKey: PrivateKey,
        zkAppInstance: Examina

    beforeAll(async () => {
        if (proofsEnabled) { await Examina.compile() }

        ({ privateKey: deployerKey, publicKey: deployerAccount } = createLocalBlockchain())
        zkAppPrivateKey = PrivateKey.random()
        zkAppAddress = zkAppPrivateKey.toPublicKey()
        zkAppInstance = new Examina(zkAppAddress)

        const txn = await Mina.transaction(deployerAccount, () => {
            AccountUpdate.fundNewAccount(deployerAccount)

            merkleTree = new MerkleTree(20)

            zkAppInstance.deploy()
        })

        await txn.prove()
        await txn.sign([deployerKey, zkAppPrivateKey]).send()
    })
    
    it("generates and deploys the `Examina` smart contract (create an exam)", async () => {
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

        answers = Field.fromBits(answers_in_booleans)
        examKey = Field.random()

        const txn = await Mina.transaction(deployerAccount, () => {
            zkAppInstance.initState(answers, examKey, questions, merkleTree.getRoot())
        })

        await txn.prove()
        await txn.sign([deployerKey]).send()

        expect(zkAppInstance.answers.get()).toEqual(Poseidon.hash([answers, examKey]))
        expect(zkAppInstance.examSecretKey.get()).toEqual(Poseidon.hash(examKey.toFields()))
        expect(zkAppInstance.isOver.get()).toEqual(Bool(false).toField())
        expect(zkAppInstance.hashedQuestions.get()).toEqual(questions)
        expect(zkAppInstance.usersRoot.get()).toEqual(merkleTree.getRoot())
    })
})

