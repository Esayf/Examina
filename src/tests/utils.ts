import { AccountUpdate, Field, Mina, PrivateKey, PublicKey, UInt64 } from 'o1js';
import { Quiz } from '../Quiz';
import { adminKey } from '../Quiz';
export { randomAccounts, testSetup, settle };

const SECRET_KEY = Field(1);

function randomAccounts<K extends string>(
    ...names: [K, ...K[]]
): { keys: Record<K, PrivateKey>; addresses: Record<K, PublicKey> } {
    let base58Keys = Array(names.length)
        .fill('')
        .map(() => PrivateKey.random().toBase58());
    let keys = Object.fromEntries(
        names.map((name, idx) => name === 'admin' ? [name, adminKey] : [name, PrivateKey.fromBase58(base58Keys[idx])])
    ) as Record<K, PrivateKey>;
    let addresses = Object.fromEntries(
        names.map((name) => [name, keys[name].toPublicKey()])
    ) as Record<K, PublicKey>;
    return { keys, addresses };
}

async function testSetup(
    quiz_contract: Quiz,
    sender: { address: PublicKey; key: PrivateKey },
    addresses: Record<string, PublicKey>,
    keys: Record<string, PrivateKey>
) {
    /**
     * Currently this test setup runs once before all tests.
     * Ideally it would run before each test to create a fresh instance of all artifacts.
     * Since `offchainState` is a singleton instance deeply integrated with the contract,
     * we cannot deploy different instances of the contract with different offchain states
     * to test.
     *
     * TODO: Decouple instances of `offchainState` from the compiled circuit.
     *
     */

    const deployTx = await Mina.transaction(
        { sender: sender.address, fee: 1e5 },
        async () => {
            AccountUpdate.fundNewAccount(sender.address);
            quiz_contract.deploy();
        }
    );
    await deployTx.prove();
    deployTx.sign([sender.key, keys.contract]);
    await deployTx.send().wait();

    const fundTx = await Mina.transaction(
        { sender: sender.address, fee: 1e5 },
        async () => {
            const au = AccountUpdate.fundNewAccount(sender.address, 2);
            au.send({ to: addresses.user1, amount: 1e9 });
            au.send({ to: addresses.user2, amount: 1e9 });
        }
    );
    fundTx.sign([sender.key]);
    await fundTx.send().wait();

    const initTx = await Mina.transaction(
        { sender: sender.address, fee: 1e9 },
        async () => {
            await quiz_contract.initQuizState(SECRET_KEY, UInt64.from(10 * 100 * 60), UInt64.from(Date.now()), UInt64.from(1000));
        }
    );
    await initTx.prove();
    initTx.sign([sender.key]);
    await initTx.send().wait();

    await settle(quiz_contract, sender);
}
async function settle(
    quiz_contract: Quiz,
    sender: { address: PublicKey; key: PrivateKey }
) {
    const settlementProof =
        await quiz_contract.offchainState.createSettlementProof();

    const settleTx = await Mina.transaction(
        { sender: sender.address, fee: 1e5 },
        async () => {
            await quiz_contract.settle(settlementProof);
        }
    );
    settleTx.sign([sender.key]);
    await settleTx.prove();
    await settleTx.send().wait();
}