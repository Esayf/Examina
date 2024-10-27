import { Quiz, offchainState, adminKey } from "../Quiz";
import { Field, Mina, PublicKey, PrivateKey } from "o1js";
import { randomAccounts, testSetup } from "./utils";

let sender: { address: PublicKey; key: PrivateKey };
let quiz_contract: Quiz;
let addresses: Record<string, PublicKey>;
let keys: Record<string, PrivateKey>;

describe("Quiz", () => {
    it("should pay out the winners", async () => {
        const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
        const { keys: _keys, addresses: _addresses } = randomAccounts(
            'contract',
            'user1',
            'user2'
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
    });
});