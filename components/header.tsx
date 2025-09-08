"use client";

import { Card, CardContent } from "@/components/ui/card"
import { FORM_TITLE, STEPS } from "@/lib/constants"
import { useForm } from "./form-context";
import { Progress } from "@/components/ui/progress";

export const Header = ({}) => {
  const { currentStep, isSubmitted } = useForm();

  const isGreeting = currentStep === -1;

  if (isGreeting || isSubmitted) {
    return <></>
  }

  const renderContent = () => {
    if (isGreeting) {
      return <h1 className="text-center text-xl uppercase font-bold leading-none">{FORM_TITLE}</h1>
    }
    
    if (isSubmitted) {
      return <h1 className="text-center text-xl uppercase font-bold leading-none">Thank you!</h1>
    }

    return (
      <div className="flex gap-x-6 justify-between items-center">
        <Progress value={currentStep * 100 / (STEPS.length - 1)} className="flex-1" />
        <span className="text-sm text-muted-foreground">{currentStep + 1} / {STEPS.length}</span>
      </div>
    )
  }

  return (
    <Card className="relative !py-4 w-full">
      <CardContent className="!px-6">
        {renderContent()}
      </CardContent>
    </Card>
  )
}
