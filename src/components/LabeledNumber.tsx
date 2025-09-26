export const LabeledNumber = ({
	label,
	value,
	onChange,
	step = 1,
}: LabeledNumberProps) => {
	return (
		<label className="flex items-center gap-2 text-sm">
			<span className="w-40">{label}</span>
			<input
				type="number"
				step={step}
				value={value}
				onChange={(e) => onChange(e.target.value === "" ? (0) : Number(e.target.value))}
				className="flext-1 border rounded-x1 px-2 py-1"
			/>
		</label>
	);
};

interface LabeledNumberProps {
	label: string;
	value: number | string;
	onChange: (value: number) => void;
	step?: number;
}
