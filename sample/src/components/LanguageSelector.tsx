import React from 'react';
import { useLanguage, Language } from '../contexts/LanguageContext';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    const newLanguage = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLanguage);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="language-selector"
      title={language === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <span className="language-icon">
        {language === 'zh' ? '🇨🇳' : '🇺🇸'}
      </span>
      <span className="language-text">
        {language === 'zh' ? 'EN' : '中'}
      </span>
    </button>
  );
};

export default LanguageSelector;
