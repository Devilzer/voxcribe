import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button, type ButtonProps } from '../ui/button';
import { copyText } from '../../services/dictation';

export function CopyButton({ text, ...props }: { text: string } & Omit<ButtonProps, 'onClick'>) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={text.length === 0} onClick={() => void onClick()} {...props}>
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
