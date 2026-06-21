type PremiumSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function PremiumSwitch({ checked, onChange, label }: PremiumSwitchProps) {
  return (
    <button
      aria-label={label}
      aria-checked={checked}
      className={`premium-switch ${checked ? "is-on" : ""}`}
      data-smart-tip={label}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span className="premium-switch__track" />
      <span className="premium-switch__thumb" />
    </button>
  );
}
