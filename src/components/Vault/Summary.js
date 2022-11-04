import React, {useEffect, useState, useMemo} from 'react';
import dayjs from 'dayjs';
import duration from '../../../node_modules/dayjs/plugin/duration';
import {FixedNumber} from 'ethers';
import {formatTokens, formatPercent, formatBps} from '../../utils/utils';
import {useSimulator} from './SimulatorProvider';
import {useVault} from './VaultProvider';
import {Pebble} from '../controls';
import {BsLightningChargeFill} from 'react-icons/bs';
import {BiBadgeCheck} from 'react-icons/bi';
import useLocalStorage from '../../utils/useLocalStorage';

dayjs.extend(duration);

function Row({className, children}) {
	return <div className={`py-1 w-full grid items-center justify-between ${className}`}>
		{children}
	</div>;
}

function Cell({className, children}) {
	return <div className={`${className}`}>
		{children}
	</div>;
}

function BpsCell({value}) {
	return <Cell className={`
		font-mono text-right
		${value < 0 ? 'text-red-400' : 'text-primary-600 dark:text-primary-400'}`}>
		{`${Number.isFinite(value) ? value < 0 ? '' : '+' : ''}${formatBps(value, '--')}`}
	</Cell>;
}

export default function Summary({className}) {
	const {vault, token} = useVault();
	const simulator = useSimulator();
	const [apyDelta, setApyDelta] = useState();
	const [liveApy, setLiveApy] = useLocalStorage('vault.liveApy', false);

	const degradation = useMemo(() => {
		if(!simulator.degradationTime) return '';
		const duration = dayjs.duration(simulator.degradationTime * 1000);
		if(duration.asHours() >= 1) return ` (+${Math.floor(duration.asHours())}hr)`;
		return ` (+${Math.floor(duration.asMinutes())}min)`;
	}, [simulator]);

	useEffect(() => {
		if(simulator.nextApy) {
			const pps = FixedNumber.from(simulator.nextApy.pps.sub(simulator.currentApy.pps))
				.divUnsafe(FixedNumber.from(simulator.currentApy.pps))
				.mulUnsafe(FixedNumber.from(10_000))
				.toUnsafeFloat();

			const currentApy = liveApy
				? simulator.currentApy
				: vault.apy;

			setApyDelta({
				[-7]: simulator.nextApy[-7] - currentApy[-7],
				[-30]: simulator.nextApy[-30] - currentApy[-30],
				inception: simulator.nextApy.inception - currentApy.inception,
				net: simulator.nextApy.net - currentApy.net,
				gross: simulator.nextApy.gross - currentApy.gross,
				pps
			});
		} else {
			setApyDelta();
		}
	}, [vault, simulator, liveApy]);

	const allocated = useMemo(() => {
		if(vault.totalAssets.eq(0)) return 0;
		return vault.debtRatio / 10_000;
	}, [vault]);

	const utilization = useMemo(() => {
		if(vault.depositLimit.eq(0)) return NaN;
		return 1 - vault.availableDepositLimit?.mul(10_000).div(vault.depositLimit) / 10_000;
	}, [vault]);

	return <div className={`
		self-start px-4 sm:pl-8 sm:pr-4 flex flex-col
		gap-4 sm:gap-8
		${className}`}>
		<div>
			<Row className={'grid-cols-2'}>
				<Cell className={'font-bold text-2xl'}>{'Total Assets'}</Cell>
				<Cell className={'font-bold font-mono text-3xl text-right'}>{formatTokens(vault.totalAssets, token.decimals, 2, true)}</Cell>
			</Row>
			<Row className={'grid-cols-2'}>
				<Cell>{'Free Assets'}</Cell>
				<Cell className={'font-mono text-right'}>{formatTokens(vault.totalAssets - vault.totalDebt, token.decimals, 2, true)}</Cell>
			</Row>
			<Row className={'grid-cols-2'}>
				<Cell>{'Allocated'}</Cell>
				<Cell className={'font-mono text-right'}>{formatPercent(allocated, 2, '--')}</Cell>
			</Row>
			<Row className={'grid-cols-2'}>
				<Cell>{'Deposit Limit'}</Cell>
				<Cell className={'font-mono text-right'}>{formatTokens(vault.depositLimit, token.decimals, 2, true)}</Cell>
			</Row>
			<Row className={'grid-cols-2'}>
				<Cell>{'Utilization'}</Cell>
				<Cell className={'font-mono text-right'}>{formatPercent(utilization, 2)}</Cell>
			</Row>
		</div>

		<div className={'mb-4'}>
			<Row className={'grid-cols-4'}>
				<Cell>{'Current APY'}<div className={'text-xs'}>{vault.apy.type}</div></Cell>
				<Cell className={'mr-4 flex justify-end'}>
					<Pebble title={liveApy ? 'Switch to exporter APY' : 'Switch to live APY'} 
						onClick={() => setLiveApy(current => !current)}>
						{liveApy && <BsLightningChargeFill className={'stroke-secondary-600 dark:stroke-secondary-300'} />}
						{!liveApy && <BiBadgeCheck className={'stroke-secondary-600 dark:stroke-secondary-300'} />}
					</Pebble>
				</Cell>
				<Cell className={'col-span-2 text-primary-600 dark:text-primary-400 text-right'}>{`Simulated APY${degradation}`}</Cell>
			</Row>
			<Row className={'grid-cols-4'}>
				<Cell>{'Gross'}</Cell>
				{liveApy && <Cell className={'font-mono text-right'}>{formatPercent(simulator?.currentApy?.gross, 4, '--')}</Cell>}
				{!liveApy && <Cell className={'font-mono text-right'}>{formatPercent(vault.apy.gross, 4)}</Cell>}
				<Cell className={'font-mono text-primary-600 dark:text-primary-400 text-right'}>{formatPercent(simulator?.nextApy?.gross, 4, '--')}</Cell>
				<BpsCell value={apyDelta?.gross} />
			</Row>
			<Row className={'grid-cols-4 bg-selected-400/5'}>
				<Cell className={'font-bold'}>{'Net'}</Cell>
				{liveApy && <Cell className={'font-bold font-mono text-right'}>{formatPercent(simulator?.currentApy?.net, 4, '--')}</Cell>}
				{!liveApy && <Cell className={'font-bold font-mono text-right'}>{formatPercent(vault.apy.net, 4)}</Cell>}
				<Cell className={'font-bold font-mono text-primary-600 dark:text-primary-400 text-right'}>{formatPercent(simulator?.nextApy?.net, 4, '--')}</Cell>
				<BpsCell value={apyDelta?.net} />
			</Row>
			<Row className={'grid-cols-4'}>
				<Cell>{'Weekly'}</Cell>
				{liveApy && <Cell className={'font-mono text-right'}>{formatPercent(simulator?.currentApy?.[-7], 4, '--')}</Cell>}
				{!liveApy && <Cell className={'font-mono text-right'}>{formatPercent(vault.apy[-7], 4)}</Cell>}
				<Cell className={'font-mono text-primary-600 dark:text-primary-400 text-right'}>{formatPercent(simulator?.nextApy?.[-7], 4, '--')}</Cell>
				<BpsCell value={apyDelta?.[-7]} />
			</Row>
			<Row className={'grid-cols-4 bg-selected-400/5'}>
				<Cell>{'Monthly'}</Cell>
				{liveApy && <Cell className={'font-mono text-right'}>{formatPercent(simulator?.currentApy?.[-30], 4, '--')}</Cell>}
				{!liveApy && <Cell className={'font-mono text-right'}>{formatPercent(vault.apy[-30], 4)}</Cell>}
				<Cell className={'font-mono text-primary-600 dark:text-primary-400 text-right'}>{formatPercent(simulator?.nextApy?.[-30], 4, '--')}</Cell>
				<BpsCell value={apyDelta?.[-30]} />
			</Row>
			<Row className={'grid-cols-4'}>
				<Cell>{'Inception'}</Cell>
				{liveApy && <Cell className={'font-mono text-right'}>{formatPercent(simulator?.currentApy?.inception, 4, '--')}</Cell>}
				{!liveApy && <Cell className={'font-mono text-right'}>{formatPercent(vault.apy.inception, 4)}</Cell>}
				<Cell className={'font-mono text-primary-600 dark:text-primary-400 text-right'}>{formatPercent(simulator?.nextApy?.inception, 4, '--')}</Cell>
				<BpsCell value={apyDelta?.inception} />
			</Row>
			<Row className={'grid-cols-4 bg-selected-400/5'}>
				<Cell>{'PPS (x1000)'}</Cell>
				<Cell></Cell>
				<Cell></Cell>
				<Cell className={'font-mono text-primary-600 dark:text-primary-400 text-right'}>{apyDelta?.pps ? '+' : ''}{formatPercent(apyDelta?.pps, 2, '--')}</Cell>
			</Row>
		</div>
	</div>;
}