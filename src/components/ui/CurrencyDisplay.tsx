import * as React from "react";
import { formatCurrency } from "../../utils/formatters";
import { useUIStore } from "../../stores/uiStore";

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  className = ""
}) => {
  const language = useUIStore((state) => state.language);
  const formatted = formatCurrency(amount, language);

  return (
    <span dir="ltr" className={`font-semibold tabular-nums ${className}`}>
      {formatted}
    </span>
  );
};
export default CurrencyDisplay;
