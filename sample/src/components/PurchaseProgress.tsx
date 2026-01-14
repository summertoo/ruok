import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PurchaseProgressProps {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  isComplete: boolean;
  error?: string;
}

const PurchaseProgress: React.FC<PurchaseProgressProps> = ({
  currentStep,
  totalSteps,
  stepName,
  isComplete,
  error
}) => {
  const { t } = useLanguage();
  const progressPercentage = (currentStep / totalSteps) * 100;

  const steps = [
    t('purchase.step1'),
    t('purchase.step2'),
    t('purchase.step3'),
    t('purchase.step4'),
    t('purchase.step5')
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isComplete ? t('purchase.completed') : t('purchase.title')}
          </h3>
          <p className="text-sm text-gray-600">{stepName}</p>
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{t('purchase.step')} {currentStep} {t('purchase.of')} {totalSteps}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                error ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-2 mb-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center text-sm ${
                index + 1 < currentStep
                  ? 'text-green-600'
                  : index + 1 === currentStep
                  ? error
                    ? 'text-red-600'
                    : 'text-blue-600 font-medium'
                  : 'text-gray-400'
              }`}
            >
              <div className={`w-4 h-4 rounded-full mr-2 flex items-center justify-center ${
                index + 1 < currentStep
                  ? 'bg-green-500'
                  : index + 1 === currentStep
                  ? error
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                  : 'bg-gray-300'
              }`}>
                {index + 1 < currentStep ? (
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              {step}
            </div>
          ))}
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* 成功信息 */}
        {isComplete && !error && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">{t('purchase.success')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseProgress;
