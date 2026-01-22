import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { useStore } from '@/store/useStore';
import { analyzeFood } from '@/services/ai/client';
import { addFoodEntry } from '@/db';
import { generateId, getToday } from '@/lib/utils';
import type { ChatMessage, FoodEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, addMessage, updateMessage, settings, isAnalyzing, setIsAnalyzing } =
    useStore();

  const [editingEntry, setEditingEntry] = useState<Partial<FoodEntry> | null>(null);
  const [editProtein, setEditProtein] = useState('');
  const [editName, setEditName] = useState('');
  const [editMessageId, setEditMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on first load
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: generateId(),
        type: 'system',
        content:
          "Hi! I'm here to help you track protein. Type what you ate (like \"200g chicken breast\") or take a photo of your food or nutrition label.",
        timestamp: new Date(),
      });
    }
  }, []);

  const handleSendText = async (text: string) => {
    const userMessageId = generateId();
    addMessage({
      id: userMessageId,
      type: 'user',
      content: text,
      timestamp: new Date(),
    });

    if (!settings.claudeApiKey) {
      addMessage({
        id: generateId(),
        type: 'system',
        content:
          'Please add your Claude API key in Settings to enable AI-powered food analysis.',
        timestamp: new Date(),
      });
      return;
    }

    const loadingId = generateId();
    addMessage({
      id: loadingId,
      type: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
    });

    setIsAnalyzing(true);

    try {
      const result = await analyzeFood(settings.claudeApiKey, { text });

      updateMessage(loadingId, {
        isLoading: false,
        content: result.reasoning || 'Here\'s what I found:',
        foodEntry: {
          date: getToday(),
          source: 'text',
          foodName: result.foodName,
          protein: result.protein,
          confidence: result.confidence,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      updateMessage(loadingId, {
        isLoading: false,
        content: `Sorry, I couldn't analyze that. ${error instanceof Error ? error.message : 'Please try again.'}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendImage = async (imageData: string) => {
    const userMessageId = generateId();
    addMessage({
      id: userMessageId,
      type: 'user',
      content: '',
      imageData,
      timestamp: new Date(),
    });

    if (!settings.claudeApiKey) {
      addMessage({
        id: generateId(),
        type: 'system',
        content:
          'Please add your Claude API key in Settings to enable AI-powered food analysis.',
        timestamp: new Date(),
      });
      return;
    }

    const loadingId = generateId();
    addMessage({
      id: loadingId,
      type: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
    });

    setIsAnalyzing(true);

    try {
      const result = await analyzeFood(settings.claudeApiKey, { imageBase64: imageData });

      updateMessage(loadingId, {
        isLoading: false,
        content: result.reasoning || 'Here\'s what I found:',
        foodEntry: {
          date: getToday(),
          source: 'photo',
          foodName: result.foodName,
          protein: result.protein,
          confidence: result.confidence,
          imageData,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      updateMessage(loadingId, {
        isLoading: false,
        content: `Sorry, I couldn't analyze that image. ${error instanceof Error ? error.message : 'Please try again.'}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async (entry: ChatMessage['foodEntry']) => {
    if (!entry) return;

    try {
      await addFoodEntry({
        date: entry.date || getToday(),
        source: entry.source || 'manual',
        foodName: entry.foodName || 'Unknown',
        protein: entry.protein || 0,
        confidence: entry.confidence || 'medium',
        imageData: entry.imageData,
        createdAt: new Date(),
      });

      addMessage({
        id: generateId(),
        type: 'system',
        content: `Added ${entry.protein}g protein from ${entry.foodName}`,
        timestamp: new Date(),
      });
    } catch (error) {
      addMessage({
        id: generateId(),
        type: 'system',
        content: 'Failed to save entry. Please try again.',
        timestamp: new Date(),
      });
    }
  };

  const handleEdit = (entry: ChatMessage['foodEntry'], messageId?: string) => {
    if (!entry) return;
    setEditingEntry(entry);
    setEditProtein(entry.protein?.toString() || '0');
    setEditName(entry.foodName || '');
    setEditMessageId(messageId || null);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    const updatedEntry = {
      ...editingEntry,
      protein: parseInt(editProtein, 10) || 0,
      foodName: editName || editingEntry.foodName,
    };

    // Update the message if we have the ID
    if (editMessageId) {
      updateMessage(editMessageId, {
        foodEntry: updatedEntry as FoodEntry,
      });
    }

    // Confirm the edited entry
    await handleConfirm(updatedEntry as FoodEntry);

    setEditingEntry(null);
    setEditMessageId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onConfirm={(entry) => handleConfirm(entry)}
            onEdit={(entry) => handleEdit(entry, message.id)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSendText={handleSendText}
        onSendImage={handleSendImage}
        disabled={isAnalyzing}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Food Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Protein (grams)</label>
              <Input
                type="number"
                value={editProtein}
                onChange={(e) => setEditProtein(e.target.value)}
                min={0}
                max={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save & Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
