import { useState, useRef } from 'react';
import { Camera, Send, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { compressImage } from '@/lib/utils';

interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendImage: (imageData: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendText, onSendImage, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendText(text.trim());
      setText('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !disabled) {
      try {
        const compressed = await compressImage(file);
        onSendImage(compressed);
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="border-t bg-background p-3 safe-area-inset-bottom">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        {/* Camera capture button */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
        >
          <Camera className="h-5 w-5" />
          <span className="sr-only">Take photo</span>
        </Button>

        {/* File upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <ImageIcon className="h-5 w-5" />
          <span className="sr-only">Upload image</span>
        </Button>

        {/* Text input */}
        <Input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="200g chicken breast..."
          disabled={disabled}
          className="flex-1"
        />

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || disabled}
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
