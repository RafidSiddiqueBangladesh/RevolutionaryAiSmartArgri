import React, { useState } from 'react';
import './ChatbotButton.css';
import { MessageSquare, Bot } from 'lucide-react';

const ChatbotButton = ({ onClick, hasNewMessage = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="chatbot-button-container">
      <button
        className={`chatbot-fab ${hasNewMessage ? 'has-notification' : ''}`}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Open AgriSense AI Chat"
      >
        <div className="chatbot-fab-icon" aria-hidden="true">
          {isHovered ? <MessageSquare /> : <Bot />}
        </div>
        {hasNewMessage && <div className="notification-dot"></div>}
      </button>
      
      <div className={`chatbot-tooltip ${isHovered ? 'visible' : ''}`}>
        <div className="tooltip-content">
          <strong>AgriSense AI</strong>
          <span>Ask about your farm, soil, weather & more!</span>
        </div>
        <div className="tooltip-arrow"></div>
      </div>
    </div>
  );
};

export default ChatbotButton;
