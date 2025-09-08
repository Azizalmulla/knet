"use client";

import { cn } from "@/lib/utils";
import { Form } from "./form";
import { useForm } from "./form-context";
import { Greeting } from "./greeting";
import { Header } from "./header";
import { ThankYou } from "./thank-you";
import { Lights } from "./lights";

export const FormRenderer = ({ setupCompleted }: { setupCompleted: boolean }) => {
  const { currentStep, steps, isSubmitted } = useForm();

  const isGreeting = currentStep === -1;
  const isThankYou = isSubmitted || currentStep === steps.length;
  const className = "relative flex-1 md:max-h-[700px] w-full"

  const renderStep = () => {
    if (isGreeting) {
      return <Greeting className={className} setupCompleted={setupCompleted} />;
    }

    if (isThankYou) {
      return <ThankYou className={className} />;
    }

    return <Form className={className} />;
  }

  return (
    <div className={cn("relative flex flex-col flex-1 items-center justify-center gap-4 p-4 h-full w-full mx-auto", isGreeting ? "max-w-7xl" : "max-w-2xl")}>
      <Lights>
        <Header />
        {renderStep()}
      </Lights>
    </div>
  );
}
