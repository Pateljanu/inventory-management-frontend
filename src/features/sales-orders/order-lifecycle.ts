import { useConfirm } from "@/components/common/confirm-dialog"
import { useSaveSalesOrder, useSettleOrder } from "./api"
import { amountFrom } from "@/lib/decimal"
import { formatMoney, formatTons } from "@/lib/format"
import { notify } from "@/lib/notify"
import { errorMessage } from "@/lib/errors"
import type { SalesPO } from "@/types/api"

export const isOpenOrder = (po: SalesPO) =>
  po.displayStatus === "PENDING" || po.displayStatus === "PARTIALLY_SUPPLIED"

/** Cancel (with confirmation), settle or reopen an order. */
export function useOrderLifecycle() {
  const confirm = useConfirm()
  const save = useSaveSalesOrder()
  const settleOrder = useSettleOrder()

  /** Delivered less than ordered: close the order at what was delivered. */
  const settle = async (po: SalesPO) => {
    const delivered = formatTons(po.soldQuantityTons, { unit: true })
    const ok = await confirm({
      title: `Settle order ${po.poNumber}?`,
      description: `${formatTons(po.remainingQuantityTons, { unit: true })} is still left. Settling sets the order to what was delivered: ${formatTons(po.quantityTons)} → ${delivered}, ${formatMoney(po.totalPOAmount)} → ${formatMoney(amountFrom(po.soldQuantityTons, po.ratePerTon))}. The rate stays the same and the order shows as completed. To send more later, edit the order's tons.`,
      cancelLabel: "Keep open",
      confirmLabel: `Settle at ${delivered}`,
      onConfirm: () => settleOrder.mutateAsync(po._id),
    })
    if (ok) notify.success("Order settled", { description: `${po.poNumber} · completed at ${delivered}` })
  }

  const cancel = async (po: SalesPO) => {
    const ok = await confirm({
      title: `Cancel order ${po.poNumber}?`,
      description: isOpenOrder(po)
        ? `${formatTons(po.remainingQuantityTons, { unit: true })} is still left to deliver. It will no longer count as open demand, and no more deliveries can be recorded against it. Deliveries already made stay unchanged.`
        : "No more deliveries can be recorded against it. Deliveries already made stay unchanged.",
      cancelLabel: "Keep order",
      confirmLabel: "Cancel order",
      destructive: true,
      onConfirm: () => save.mutateAsync({ id: po._id, input: { lifecycleStatus: "CANCELLED" } }),
    })
    if (ok) notify.success("Order cancelled", { description: po.poNumber })
  }

  const reopen = async (po: SalesPO) => {
    try {
      await save.mutateAsync({ id: po._id, input: { lifecycleStatus: "ACTIVE" } })
      notify.success("Order reopened", { description: po.poNumber })
    } catch (error) {
      notify.error("Couldn't reopen the order", { description: errorMessage(error) })
    }
  }

  return { cancel, settle, reopen }
}
