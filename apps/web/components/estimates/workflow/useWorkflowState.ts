import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Workflow state for multi-step estimate creation
 * Tracks current step, unlock status, and form data
 */
interface WorkflowState {
  estimateId: string | null;
  currentStep: number;
  maxUnlockedStep: number;
  formData: Partial<any>;

  // Actions
  setEstimateId: (id: string) => void;
  goToStep: (step: number) => void;
  unlockStep: (step: number) => void;
  updateFormData: (data: Partial<any>) => void;
  reset: () => void;
}

export const useWorkflowState = create<WorkflowState>()(
  persist(
    (set, get) => ({
      estimateId: null,
      currentStep: 1,
      maxUnlockedStep: 1,
      formData: {},

      setEstimateId: (id: string) => {
        set({ estimateId: id });
      },

      goToStep: (step: number) => {
        const { maxUnlockedStep } = get();
        // Only allow navigation to unlocked steps
        if (step <= maxUnlockedStep) {
          set({ currentStep: step });
        }
      },

      unlockStep: (step: number) => {
        set((state) => ({
          maxUnlockedStep: Math.max(state.maxUnlockedStep, step),
        }));
      },

      updateFormData: (data: Partial<any>) => {
        set((state) => ({
          formData: { ...state.formData, ...data },
        }));
      },

      reset: () => {
        set({
          estimateId: null,
          currentStep: 1,
          maxUnlockedStep: 1,
          formData: {},
        });
      },
    }),
    {
      name: 'estimate-workflow-state',
      // Only persist estimateId and currentStep (not all form data)
      partialize: (state) => ({
        estimateId: state.estimateId,
        currentStep: state.currentStep,
      }),
    }
  )
);
