import { AlertCircle, RotateCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';
import { QuickReplies } from './QuickReplies';
import { TypingIndicator } from './TypingIndicator';
import { MarkdownText } from './MarkdownText';

interface MessageBubbleProps {
  message: ChatMessage;
  onQuickReply?: (reply: string) => void;
  onResend?: (syncId: string) => void;
  isLatestMessage?: boolean;
}

export function MessageBubble({
  message,
  onQuickReply,
  onResend,
  isLatestMessage,
}: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isFailed = isUser && message.status === 'failed';
  const isPending = isUser && message.status === 'pending';

  // Get images array (support both legacy imageData and new images array)
  const messageImages = message.images || (message.imageData ? [message.imageData] : []);
  const hasImages = messageImages.length > 0;

  // Show quick replies only for latest message with advisor replies
  const showQuickReplies = isLatestMessage &&
    message.advisorQuickReplies &&
    message.advisorQuickReplies.length > 0;

  return (
    <div
      className={cn(
        'flex w-full mb-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn('max-w-[85%] min-w-0', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            isUser
              ? hasImages
                ? 'rounded-2xl rounded-br-md overflow-hidden bg-primary text-primary-foreground'
                : 'rounded-2xl rounded-br-md px-4 py-2 bg-primary text-primary-foreground'
              : message.isError
                ? 'text-sm py-2 px-3 rounded-xl bg-red-50 text-red-700 border border-red-200'
                : 'text-foreground/80 text-sm py-1',
            isFailed && 'opacity-70'
          )}
        >
          {message.isLoading ? (
            <div className="px-1">
              <TypingIndicator isAnalyzing={message.isAnalyzingImage} />
            </div>
          ) : (
            <>
              {hasImages && (
                <div className={cn(
                  'flex gap-1 overflow-hidden',
                  messageImages.length > 1 ? 'flex-wrap' : ''
                )}>
                  {messageImages.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Food ${index + 1}`}
                      loading="lazy"
                      className={cn(
                        'block object-cover max-w-full',
                        messageImages.length === 2
                          ? 'w-[calc(50%-2px)] aspect-square'
                          : messageImages.length > 2
                            ? 'w-[calc(33.333%-2.67px)] aspect-square'
                            : ''
                      )}
                    />
                  ))}
                </div>
              )}
              {message.content && (
                <div className={cn('text-sm min-w-0', hasImages && isUser && 'px-4 py-2')}>
                  {message.isError && (
                    <AlertCircle className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
                  )}
                  <MarkdownText>{message.content}</MarkdownText>
                </div>
              )}
              {showQuickReplies && onQuickReply && (
                <QuickReplies
                  replies={message.advisorQuickReplies!}
                  onSelect={onQuickReply}
                />
              )}
            </>
          )}
        </div>

        {/* Failed message: Resend button */}
        {isFailed && onResend && (
          <button
            onClick={() => onResend(message.syncId)}
            className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-red-600 hover:text-red-700 active:text-red-800 transition-colors"
          >
            <RotateCw className="h-3 w-3" />
            Resend
          </button>
        )}

        {/* Pending indicator */}
        {isPending && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sending...
          </div>
        )}
      </div>
    </div>
  );
}
