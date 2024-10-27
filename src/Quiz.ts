
import { AccountUpdate, assert, Bool, Experimental, Field, method, Poseidon, PrivateKey, PublicKey, SmartContract, state, State, Struct, UInt64 } from 'o1js';
class PauseToggleEvent extends Struct({ was_paused: Bool, is_paused: Bool }) {}

export class WinnerState extends Struct({
    amount: UInt64,
    isPaid: Bool,
    finishDate: UInt64
}) {}

const { OffchainState } = Experimental;
const adminKey = PrivateKey.random().toPublicKey();
export const offchainState = OffchainState(
    {
        winners: OffchainState.Map(PublicKey, WinnerState),
    },
    { logTotalCapacity: 20, maxActionsPerProof: 6, maxActionsPerUpdate: 6 }
);
export class StateProof extends offchainState.Proof { }

export class Quiz extends SmartContract {
    @state(Field) examSecretKey = State<Field>();
    @state(Field) duration = State<UInt64>();
    @state(Field) startDate = State<UInt64>();
    @state(UInt64) rewardPerWinner = State<UInt64>();
    @state(OffchainState.Commitments) offchainStateCommitments = offchainState.emptyCommitments();
    @state(PublicKey) admin = State<PublicKey>();
    @state(PublicKey) creator = State<PublicKey>();
    offchainState = offchainState.init(this);
    @state(Bool) paused = State<Bool>();


    events = {
        pause_toggle_event: PauseToggleEvent,
    }

    init() {
        super.init();
        this.admin.set(adminKey);
        this.creator.set(this.sender.getAndRequireSignature());
        this.paused.set(Bool(false));
    }


    @method async initQuizState(
        secretKey: Field,
        duration: UInt64,
        startDate: UInt64,
        totalRewardPoolAmount: UInt64 // This is the total reward pool
    ) {
        const creator = this.creator.getAndRequireEquals();
        assert(creator.equals(this.sender.getAndRequireSignature()), "Only the creator can initialize the state");
        this.examSecretKey.set(Poseidon.hash(secretKey.toFields()));
        this.duration.set(duration);
        this.startDate.set(startDate);
        await this.deposit(this.sender.getAndRequireSignature(), totalRewardPoolAmount);
    }

    /**
 * Change the pause state of the smart contract, pausing it if currently unpaused or unpausing it if currently paused
 * Fails if sender is not admin
 *
 * @emits PauseToggleEvent
 */
    @method async toggle_pause() {
        let current_admin = this.admin.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        current_admin.assertEquals(sender);
        let is_paused = this.paused.getAndRequireEquals();
        this.paused.set(is_paused.not());

        this.emitEvent('pause_toggle_event', {
            was_paused: is_paused,
            is_paused: is_paused.not(),
        });
    }

    /**
 * Settles settlement proof
 *
 * @param proof - StateProof generated by the Offchain State ZkProgram
 */
    @method
    async settle(proof: StateProof) {
        await this.offchainState.settle(proof);
    }

    async deposit(user: PublicKey, amount: UInt64) {
        // add your deposit logic circuit here
        // that will adjust the amount

        const payerUpdate = AccountUpdate.createSigned(user);
        payerUpdate.send({ to: this.address, amount: amount });
    }

    @method async checkIsOver() {
        const durations = this.duration.getAndRequireEquals()
        const startDate = this.startDate.getAndRequireEquals()
        const endDate = startDate.add(durations)

        const timestamps = this.network.timestamp.getAndRequireEquals()

        timestamps.assertGreaterThanOrEqual(endDate)
    }

    @method async checkIsContinue() {
        const durations = UInt64.from(this.duration.getAndRequireEquals())
        const startDate = UInt64.from(this.startDate.getAndRequireEquals())
        const endDate = startDate.add(durations)

        this.network.timestamp.requireBetween(startDate, endDate)
    }

    // I want to send to 3 users at one payout call and I will call this function in batches
    // I will send the nullifier tree and the nullifier to the function to control if the three user batch used before
    @method async payoutByThree(
        winner1: PublicKey,
        winner2: PublicKey,
        winner3: PublicKey
    ) {
        await this.checkIsOver();
        const balance = this.account.balance.getAndRequireEquals();
        const rewardPerWinner = this.rewardPerWinner.getAndRequireEquals();
        assert(balance.greaterThanOrEqual(rewardPerWinner.mul(3)), "balance must be greater than 0");
        const winner1State = (await this.offchainState.fields.winners.get(winner1)).assertSome("Winner1 not found");
        const winner2State = (await this.offchainState.fields.winners.get(winner2)).assertSome("Winner2 not found");
        const winner3State = (await this.offchainState.fields.winners.get(winner3)).assertSome("Winner3 not found");
        assert(winner1State.isPaid.not(), "winner1 already paid");
        assert(winner2State.isPaid.not(), "winner2 already paid");
        assert(winner3State.isPaid.not(), "winner3 already paid");
        // finally, we send the payouts
        this.send({ to: winner1, amount: rewardPerWinner });
        this.send({ to: winner2, amount: rewardPerWinner });
        this.send({ to: winner3, amount: rewardPerWinner });
        this.offchainState.fields.winners.update(winner1, { from: winner1State, to: { ...winner1State, isPaid: Bool(true) } });
        this.offchainState.fields.winners.update(winner2, { from: winner2State, to: { ...winner2State, isPaid: Bool(true) } });
        this.offchainState.fields.winners.update(winner3, { from: winner3State, to: { ...winner3State, isPaid: Bool(true) } });
    }
}