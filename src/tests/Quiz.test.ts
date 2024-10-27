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
            'admin',
            'user1',
            'user2'
        );
        Mina.setActiveInstance(Local);
        sender = {
            address: Local.testAccounts[0].key.toPublicKey(),
            key: Local.testAccounts[0].key,
        };
        keys = _keys;
        addresses = _addresses;
        console.log(adminKey);
        quiz_contract = new Quiz(addresses.contract);
        quiz_contract.offchainState.setContractInstance(quiz_contract);
        await offchainState.compile();
        await Quiz.compile({forceRecompile: true});
        await testSetup(quiz_contract, sender, addresses, keys);
    });
});