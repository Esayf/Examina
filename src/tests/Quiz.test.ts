import { Quiz, offchainState, adminKey, QuizState, WinnerState } from "../Quiz";
import { Field, Mina, PublicKey, PrivateKey, UInt64, Bool } from "o1js";
import { randomAccounts, settle, testSetup } from "./utils";
import { getBalance } from "o1js/dist/node/lib/mina/mina-instance";

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
        quiz_contract.offchainState.setContractInstance(quiz_contract);
        await offchainState.compile();
        await Quiz.compile();
        await testSetup(Local, quiz_contract, sender, addresses, keys);
    })

    it("should initialize the quiz", async () => {

    })

    it("should pay out the winners", async () => {
        const quizState = new QuizState({secretKey: Field(1), duration: UInt64.from(10 * 100 * 60), startDate: UInt64.from(Date.now())})
        expect((await quiz_contract.getDuration()).toString()).toEqual(quizState.duration.toString())
        const exampleQuizState1: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        const exampleQuizState2: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        const exampleQuizState3: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        const exampleQuizState4: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        const exampleQuizState5: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        const exampleQuizState6: WinnerState = { amount: UInt64.from(1e1), isPaid: Bool(false), finishDate: UInt64.from(Date.now()) }
        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user1, exampleQuizState1)
        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user2, exampleQuizState2)
        //quiz_contract.offchainState.fields.winners.overwrite(addresses.user3, exampleQuizState3)

        let winners = [addresses.user1, addresses.user2, addresses.user3, addresses.user4, addresses.user5, addresses.user6]
        let winnerStates: WinnerState[] = [exampleQuizState1, exampleQuizState2, exampleQuizState3, exampleQuizState4, exampleQuizState5, exampleQuizState6]

        const tx = Mina.transaction(sender.address, async () => {
            await quiz_contract.setWinner(winners[0], winnerStates[0]);
            await quiz_contract.setWinner(winners[1], winnerStates[1]);
            await quiz_contract.setWinner(winners[2], winnerStates[2]);

        })
        await tx.prove()
        tx.sign([sender.key])
        await tx.send().wait()

        //--------------------------------
        const tx2 = Mina.transaction(sender.address, async () => {
            await quiz_contract.setWinner(winners[3], winnerStates[3]);
            await quiz_contract.setWinner(winners[4], winnerStates[4]);
            await quiz_contract.setWinner(winners[5], winnerStates[5]);
        })
        await tx2.prove()
        tx2.sign([sender.key])
        await tx2.send().wait()
        await settle(quiz_contract, sender)
    //--------------------------------

        expect(await quiz_contract.getWinnerState(winners[0])).toEqual(winnerStates[0])
        expect(await quiz_contract.getWinnerState(winners[1])).toEqual(winnerStates[1])
        expect(await quiz_contract.getWinnerState(winners[2])).toEqual(winnerStates[2])
        expect(await quiz_contract.getWinnerState(winners[3])).toEqual(winnerStates[3])
        expect(await quiz_contract.getWinnerState(winners[4])).toEqual(winnerStates[4])
        expect(await quiz_contract.getWinnerState(winners[5])).toEqual(winnerStates[5])

        const tx3 = Mina.transaction(sender.address, async () => {
            await quiz_contract.payoutByThree(winners[0], winners[1], winners[2]);
        })
        await tx3.prove()
        tx3.sign([sender.key])
        await tx3.send().wait()
        await settle(quiz_contract, sender)
        expect(await quiz_contract.getWinnerState(winners[0])).not.toEqual(winnerStates[0])
        expect(await quiz_contract.getWinnerState(winners[1])).not.toEqual(winnerStates[1])
        expect(await quiz_contract.getWinnerState(winners[2])).not.toEqual(winnerStates[2])

        const tx4 = Mina.transaction(sender.address, async () => {
            await quiz_contract.payoutByThree(winners[3], winners[4], winners[5]);
        })
        await tx4.prove()
        tx4.sign([sender.key])
        await tx4.send().wait()
        await settle(quiz_contract, sender)

        expect(await quiz_contract.getWinnerState(winners[3])).not.toEqual(winnerStates[3])
        expect(await quiz_contract.getWinnerState(winners[4])).not.toEqual(winnerStates[4])
        expect(await quiz_contract.getWinnerState(winners[5])).not.toEqual(winnerStates[5])

        expect(getBalance(addresses.user1).toString()).toEqual(UInt64.from(1e1+1e9).toString())
        expect(getBalance(addresses.user2).toString()).toEqual(UInt64.from(1e1+1e9).toString())
        expect(getBalance(addresses.user3).toString()).toEqual(UInt64.from(1e1+1e9).toString())
        expect(getBalance(addresses.user4).toString()).toEqual(UInt64.from(1e1+1e9).toString())
        expect(getBalance(addresses.user5).toString()).toEqual(UInt64.from(1e1+1e9).toString())
        expect(getBalance(addresses.user6).toString()).toEqual(UInt64.from(1e1+1e9).toString())
    });
});