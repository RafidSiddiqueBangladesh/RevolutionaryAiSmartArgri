import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getWelcomeMessage, getSuggestedQuestions } from '../../services/chatbotService';
import './Chatbot.css';

const Chatbot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = getWelcomeMessage();
      setMessages([
        {
          id: 1,
          type: 'bot',
          content: welcomeMessage,
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, messages.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset chat when closed and reopened (context refresh)
  useEffect(() => {
    if (!isOpen) {
      // Clear messages when chatbot is closed for context refresh
      setTimeout(() => {
        setMessages([]);
        setInputMessage('');
        setIsLoading(false);
        setIsTyping(false);
      }, 300); // Small delay to allow closing animation
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      // Send to backend with comprehensive farm context
      const response = await sendChatMessage(userMessage.content);
      
      if (response.success) {
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: response.data.response,
          timestamp: new Date(),
          farmContext: response.data.farmContext
        };
        
        // Simulate typing delay for better UX
        setTimeout(() => {
          setMessages(prev => [...prev, botMessage]);
          setIsTyping(false);
          setIsLoading(false);
        }, 1000);
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: response.fallbackResponse || "দুঃখিত, আমি আপনার অনুরোধটি প্রক্রিয়া করতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।",
          timestamp: new Date(),
          isError: true
        };
        
        setTimeout(() => {
          setMessages(prev => [...prev, errorMessage]);
          setIsTyping(false);
          setIsLoading(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: "আমি প্রযুক্তিগত সমস্যার সম্মুখীন হচ্ছি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।",
        timestamp: new Date(),
        isError: true
      };
      
      setTimeout(() => {
        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
        setIsLoading(false);
      }, 1000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestedQuestion = (question) => {
    setInputMessage(question);
    // Auto-send the suggested question
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-container">
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-avatar">🌾</div>
            <div className="chatbot-title">
              <h3>AgriSense AI</h3>
              <span className="chatbot-status">
                {isTyping ? 'AI টাইপ করছে...' : 'অনলাইন'}
              </span>
            </div>
          </div>
          <button className="chatbot-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="chatbot-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.type} ${message.isError ? 'error' : ''}`}
            >
              <div className="message-content">
                {message.content}
              </div>
              <div className="message-time">
                {formatTime(message.timestamp)}
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
            <div className="message bot typing">
              <div className="message-content">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions (show only if no messages yet or first message) */}
        {messages.length <= 1 && !isLoading && (
          <div className="chatbot-suggestions">
            <div className="suggestions-title">দ্রুত প্রশ্ন:</div>
            <div className="suggestions-grid">
              {getSuggestedQuestions().slice(0, 4).map((question, index) => (
                <button
                  key={index}
                  className="suggestion-btn"
                  onClick={() => handleSuggestedQuestion(question)}
                  disabled={isLoading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="chatbot-input">
          <div className="input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="আপনার খামার, মাটি, আবহাওয়া সম্পর্কে জিজ্ঞাসা করুন..."
              disabled={isLoading}
              maxLength={500}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="send-btn"
            >
              {isLoading ? (
                <div className="loading-spinner">⟳</div>
              ) : (
                '📤'
              )}
            </button>
          </div>
          <div className="input-footer">
            <span className="powered-by">Powered by AgriSense AI & OpenAI</span>
            <span className="char-count">{inputMessage.length}/500</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
