<script setup lang="ts">
import type { CorrectionReceipt } from "@/api/paymentCorrection";
import {
	fiscalVatOptions,
	fiscalTaxSystemOptions,
	fiscalPaymentMethodOptions,
} from "@/forms/fiscalProfileOptions";
import { correctionLineAmount } from "@/utils/correctionReceipt";
import { paymentAmount } from "@/utils/paymentDisplay";

const props = defineProps<{ receipt: CorrectionReceipt; title: string }>();
const label = (
	options: { value: number; label: string }[],
	value: number,
): string =>
	options.find((option) => option.value === value)?.label ??
	String(value);
</script>

<template>
	<section class="min-w-0 rounded border border-slate-200 p-3">
		<h4 class="mb-3 font-semibold">{{ props.title }}</h4>
		<p class="mb-2 text-sm">
			{{
				label(
					fiscalTaxSystemOptions,
					receipt.payment.taxSystem,
				)
			}}
		</p>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr>
						<th class="p-1">Позиция</th>
						<th class="p-1">Кол-во</th>
						<th class="p-1">Цена</th>
						<th class="p-1">Сумма</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="(
							item, index
						) in receipt.items"
						:key="index"
						class="border-t border-slate-100"
					>
						<td class="p-1">
							<div>
								{{ item.name }}
							</div>
							<div
								class="text-xs text-slate-500"
							>
								{{
									label(
										fiscalVatOptions,
										item.vatRate,
									)
								}}
								·
								{{
									item.paymentObject ===
									4
										? "Услуга"
										: "Товар"
								}}
								·
								{{
									label(
										fiscalPaymentMethodOptions,
										item.paymentMethod,
									)
								}}
							</div>
						</td>
						<td class="p-1">
							{{ item.quantity }}
						</td>
						<td
							class="whitespace-nowrap p-1"
						>
							{{
								paymentAmount(
									item.priceKopecks,
								)
							}}
						</td>
						<td
							class="whitespace-nowrap p-1"
						>
							{{
								paymentAmount(
									correctionLineAmount(
										item,
									),
								)
							}}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p class="mt-3 font-semibold">
			Итого: {{ paymentAmount(receipt.totalKopecks) }}
		</p>
		<dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
			<dt>Наличные</dt>
			<dd>
				{{ paymentAmount(receipt.payment.cashKopecks) }}
			</dd>
			<dt>Безналичные</dt>
			<dd>
				{{
					paymentAmount(
						receipt.payment.cashlessKopecks,
					)
				}}
			</dd>
			<dt>Зачёт аванса</dt>
			<dd>
				{{
					paymentAmount(
						receipt.payment
							.prepaymentKopecks,
					)
				}}
			</dd>
			<dt>Кредит</dt>
			<dd>
				{{
					paymentAmount(
						receipt.payment.creditKopecks,
					)
				}}
			</dd>
			<dt>Встречное предоставление</dt>
			<dd>
				{{
					paymentAmount(
						receipt.payment
							.counterProvisionKopecks,
					)
				}}
			</dd>
			<dt>Кассир</dt>
			<dd>
				{{
					receipt.additionalData.cashierName ||
					receipt.cashierName
				}}
			</dd>
			<dt>Телефон / email</dt>
			<dd>
				{{
					receipt.additionalData
						.customerContact || "—"
				}}
			</dd>
			<dt>Адрес расчётов</dt>
			<dd>
				{{
					receipt.additionalData
						.settlementAddress || "—"
				}}
			</dd>
			<dt>Место расчётов</dt>
			<dd>
				{{
					receipt.additionalData
						.settlementPlace || "—"
				}}
			</dd>
			<dt>Расчёт в интернете</dt>
			<dd>
				{{
					receipt.additionalData.internetPayment
						? "Да"
						: "Нет"
				}}
			</dd>
			<dt>Печать чека</dt>
			<dd>
				{{
					receipt.printSuppressionCode === 41029
						? "Отключена"
						: "Включена"
				}}
			</dd>
		</dl>
	</section>
</template>
