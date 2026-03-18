import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
}

export function NumericKeypad({ value, onChange }: NumericKeypadProps) {
  const handleKey = (key: string) => {
    if (key === 'C') {
      onChange('');
    } else if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else {
      const newVal = value + key;
      const num = parseInt(newVal, 10);
      if (num <= 9999999) {
        onChange(newVal);
      }
    }
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <Button
          key={key}
          type="button"
          variant={key === 'C' ? 'destructive' : 'secondary'}
          className="h-12 text-lg font-semibold"
          onClick={() => handleKey(key)}
        >
          {key}
        </Button>
      ))}
    </div>
  );
}
