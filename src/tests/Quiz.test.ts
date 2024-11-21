import { Quiz, adminKey, QuizState, WinnerState } from "../Quiz";
import { Field, Mina, PublicKey, PrivateKey, UInt64, Bool, SelfProof } from "o1js";
import { randomAccounts, testSetup } from "./utils";
import { Winner, WinnerInput, WinnerMap, WinnerOutput, WinnersProver } from "../WinnersProver";

let sender: { address: PublicKey; key: PrivateKey };
let quiz_contract: Quiz;
let addresses: Record<string, PublicKey>;
let keys: Record<string, PrivateKey>;
let Local: any;

describe("Quiz", () => {

    beforeAll(async () => {
        Local = await Mina.LocalBlockchain({ proofsEnabled: false });
        const { keys: _keys, addresses: _addresses } = randomAccounts(
            'contract',
            'user1',
            'user2',
            'user3',
            'user4',
            'user5',
            'user6'
        );

        Mina.setActiveInstance(Local);
        sender = {
            address: PrivateKey.fromBase58("EKFY3NDqUJ4SRaxidXK3nWyyoassi7dRyicZ8pubyoqbUHN84i7J").toPublicKey(),
            key: PrivateKey.fromBase58("EKFY3NDqUJ4SRaxidXK3nWyyoassi7dRyicZ8pubyoqbUHN84i7J"),
        };
        keys = _keys;
        addresses = _addresses;
        quiz_contract = new Quiz(addresses.contract);
        await Quiz.compile();
        await testSetup(Local, quiz_contract, sender, addresses, keys);
    })

/*     it("should initialize the quiz", async () => {
        const quizState = new QuizState({ secretKey: Field(1), duration: UInt64.from(10 * 100 * 60), startDate: UInt64.from(Date.now()), totalRewardPoolAmount: UInt64.from(1e1), rewardPerWinner: UInt64.from(1e1) })
        expect((await quiz_contract.getDuration()).toString()).toEqual(quizState.duration.toString())
    }) */

    it("should pay out the winners", async () => {

        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user1, exampleQuizState1)
        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user2, exampleQuizState2)
        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user3, exampleQuizState3)

        let winners = [addresses.user1, addresses.user2, addresses.user3, addresses.user4, addresses.user5, addresses.user6]
        const winnerMap = new WinnerMap()
        const proof = await WinnersProver.init(new WinnerInput({
            contractAddress: quiz_contract.address,
            previousWinner: new Winner({
                publicKey: PublicKey.empty(),
                reward: UInt64.from(0),
            }),
            winner: new Winner({
                publicKey: PublicKey.empty(),
                reward: UInt64.from(0),
            }),
            totalPaidReward: UInt64.from(0),
            previousRoot: winnerMap.root,
        }), quiz_contract.address);
        console.log("Init Root: " + proof.proof.publicOutput.newRoot.toString())
        console.log("Init Root from map: " + proof.auxiliaryOutput.root.toString())
        const setWinnersRootTx = await Mina.transaction(
            { sender: sender.address, fee: 1e9 },
            async () => {
                await quiz_contract.setWinnersRoot(proof.auxiliaryOutput.root);
            }
        );
        await setWinnersRootTx.prove();
        setWinnersRootTx.sign([sender.key]);
        await setWinnersRootTx.send().wait();
        console.log("Winner 1: " + winners[0].toString())
        console.log("Winner 1 hash: " + new Winner({ publicKey: winners[0], reward: UInt64.from(50) }).hash().toString())
        console.log("Winner 2: " + winners[1].toString())
        console.log("Winner 2 hash: " + new Winner({ publicKey: winners[1], reward: UInt64.from(50) }).hash().toString())
        console.log("Winner 3: " + winners[2].toString())
        console.log("Winner 3 hash: " + new Winner({ publicKey: winners[2], reward: UInt64.from(50) }).hash().toString())
        const newWinnerProof = await WinnersProver.addWinner(
            new WinnerInput({ contractAddress: proof.proof.publicOutput.contractAddress, previousWinner: proof.proof.publicOutput.winner, winner: new Winner({ publicKey: winners[0], reward: UInt64.from(50) }), totalPaidReward: proof.proof.publicOutput.totalPaidReward, previousRoot: proof.auxiliaryOutput.root}),
            proof.auxiliaryOutput,
            proof.proof
        );
        console.log("Second Winner Root: " + newWinnerProof.proof.publicOutput.newRoot.toString())
        console.log("Second Winner Root from map: " + newWinnerProof.auxiliaryOutput.root.toString())
        const newWinnerProof2 = await WinnersProver.addWinner(
            new WinnerInput({ contractAddress: newWinnerProof.proof.publicOutput.contractAddress, previousWinner: newWinnerProof.proof.publicOutput.winner, winner: new Winner({ publicKey: winners[1], reward: UInt64.from(50) }), totalPaidReward: newWinnerProof.proof.publicOutput.totalPaidReward, previousRoot: newWinnerProof.proof.publicOutput.newRoot }),
            newWinnerProof.auxiliaryOutput,
            newWinnerProof.proof
        );
        console.log("Third Winner Root: " + newWinnerProof2.proof.publicOutput.newRoot.toString())
        console.log("Third Winner Root from map: " + newWinnerProof2.auxiliaryOutput.root.toString())
        const initTx = await Mina.transaction(
            { sender: sender.address, fee: 1e9 },
            async () => {
                await quiz_contract.payoutByTwo(newWinnerProof.proof, newWinnerProof2.proof);
            }
        );
        await initTx.prove();
        initTx.sign([sender.key]);
        await initTx.send().wait();

        /*
                const mergedProof = await WinnersProver.mergeProofs(
            new WinnerInput({ contractAddress: newWinnerProof.proof.publicOutput.contractAddress, previousWinner: newWinnerProof.proof.publicOutput.winner, winner: new Winner({ publicKey: winners[0], reward: Field(50) }), totalPaidReward: newWinnerProof.proof.publicOutput.totalPaidReward, previousRoot: newWinnerProof.proof.publicOutput.newRoot }),
            winnerMap,
            newWinnerProof.proof as SelfProof<WinnerInput, WinnerOutput>,
            newWinnerProof2.proof as SelfProof<WinnerInput, WinnerOutput>
        );
        console.log("Merged Root: " +  mergedProof.proof.publicOutput.newRoot.toString())
        const newWinnerProof3 = await WinnersProver.addWinner(
            new WinnerInput({ contractAddress: newWinnerProof2.proof.publicOutput.contractAddress, previousWinner: newWinnerProof2.proof.publicOutput.winner, winner: new Winner({ publicKey: winners[2], reward: Field(50) }), totalPaidReward: newWinnerProof2.proof.publicOutput.totalPaidReward, previousRoot: newWinnerProof2.proof.publicOutput.newRoot }),
            winnerMap,
            newWinnerProof2.proof as SelfProof<WinnerInput, WinnerOutput>
        );
        winnerMap.insert(new Winner({ publicKey: winners[2], reward: Field(50) }).hash(), new Winner({ publicKey: winners[2], reward: Field(50) }).hash())
        console.log("Third Winner Root: " + newWinnerProof3.proof.publicOutput.newRoot.toString())
        */
    });
});