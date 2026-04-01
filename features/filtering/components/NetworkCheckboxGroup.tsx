'use client';

const NETWORKS = [
  { id: 'exoclick', label: 'ExoClick' },
  { id: 'rollerads', label: 'RollerAds' },
  { id: 'zeydoo', label: 'Zeydoo' },
  { id: 'propush', label: 'Propush' },
];

interface NetworkCheckboxGroupProps {
  selectedNetworks: string[];
  onChange: (networks: string[]) => void;
}

export default function NetworkCheckboxGroup({ selectedNetworks, onChange }: NetworkCheckboxGroupProps) {
  const allSelected = selectedNetworks.length === NETWORKS.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : NETWORKS.map(n => n.id));
  };

  const toggleOne = (id: string) => {
    onChange(
      selectedNetworks.includes(id)
        ? selectedNetworks.filter(n => n !== id)
        : [...selectedNetworks, id]
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="font-medium text-gray-700 dark:text-gray-300">All</span>
      </label>
      <span className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
      {NETWORKS.map(n => (
        <label key={n.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={selectedNetworks.includes(n.id)}
            onChange={() => toggleOne(n.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-700 dark:text-gray-300">{n.label}</span>
        </label>
      ))}
    </div>
  );
}
