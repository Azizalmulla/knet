"use client"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { STEPS, FORM_FIELD_COMPLETION_TIME_SECONDS } from "@/lib/constants"
import { useForm } from "./form-context"
import { Logo } from "./logo"

export const Greeting = ({ className, setupCompleted }: { className?: string; setupCompleted: boolean }) => {
  const { createSessionAndStart, isLoading, resetSessionAndState } = useForm()

  const handleStartSurvey = () => {
    // Always reset and start fresh to avoid conflicts with old sessions
    resetSessionAndState().then(createSessionAndStart)
  }

  const fieldCount = STEPS.reduce((acc, step) => acc + step.fields.length, 0)
  const estimatedTimeInSeconds = fieldCount * FORM_FIELD_COMPLETION_TIME_SECONDS

  const estimatedTime = estimatedTimeInSeconds >= 60 ? Math.ceil(estimatedTimeInSeconds / 60) : estimatedTimeInSeconds

  const timeUnit = estimatedTimeInSeconds >= 60 ? "minutes" : "seconds"

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-8 flex-1 py-12">
        <div className="flex flex-col justify-between items-center gap-14">
          <Logo className="w-32 md:w-52 my-2" />

          <div className="flex flex-col gap-4 md:gap-6">
            <h2 className="text-3xl md:text-4xl font-bold text-pretty text-center leading-none">
              What did you think of our service?
            </h2>
            <p className="text-xl md:text-2xl text-center text-pretty leading-tight font-medium text-muted-foreground">
              Your valuable feedback helps us to do even better next time.
            </p>
          </div>

          <div className="flex flex-col w-full gap-4">
            <p className="text-lg md:text-xl text-center text-muted-foreground">
              Takes less than {estimatedTime} {timeUnit}
            </p>
            <Button
              size="xl"
              onClick={handleStartSurvey}
              autoFocus
              className="w-full"
              disabled={isLoading || !setupCompleted}
            >
              {isLoading ? "Starting..." : setupCompleted ? "Start Survey" : "Incomplete Setup"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
