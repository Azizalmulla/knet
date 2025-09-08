"use client";

import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useForm } from "./form-context";
import { LoaderCircle } from "lucide-react";

import { Logo } from "./logo";

export const ThankYou = ({ className }: { className?: string }) => {
  const { submissionData, isSubmitted } = useForm();

  if (!isSubmitted || !submissionData) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center flex-1">
          <LoaderCircle className="h-12 w-12 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-24 justify-between flex-1">
        <Logo className="h-12 my-2" />

        <p className="text-3xl md:text-[40px] text-center text-balance leading-none font-bold">
          Hey, thanks for the feedback
          {submissionData?.first_name ? (
            <span className="capitalize">, {submissionData.first_name}</span>
          ) : (
            <></>
          )}
          !
        </p>

        <Button
          size="xl"
          autoFocus
          className="w-full"
          onClick={() => (window.location.href = "/")}
        >
          Back
        </Button>
      </CardContent>
    </Card>
  );
};
