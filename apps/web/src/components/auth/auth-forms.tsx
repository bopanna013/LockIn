"use client";

import { Button } from "@lockin/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lockin/ui/components/card";
import { useActionState } from "react";
import { Link } from "@/i18n/navigation";
import {
  confirmGuardianConsentAction,
  saveStudentProfileAction,
  sendGuardianInviteAction,
  signInAction,
  signUpAction,
  verifyEmailAction,
  type ActionState,
} from "@/server/auth-actions";
import type { StudentProfile } from "@lockin/db/schema";

const initialState: ActionState = {};

export function SignUpForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your LOCKIN account</CardTitle>
        <CardDescription>
          Enter your details below. Students under 18 will complete a quick parent or guardian
          approval step (DPDP Act 2023).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {state.error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Full name</span>
            <input
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="Aarav Sharma"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="student@example.com"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Date of birth (Age gate)</span>
            <input
              name="dateOfBirth"
              type="date"
              required
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Password (10+ characters)</span>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignInForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to LOCKIN</CardTitle>
        <CardDescription>Welcome back. Enter your email and password to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {state.error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-muted-foreground text-center text-sm">
            New to LOCKIN?{" "}
            <Link href="/sign-up" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function VerifyEmailForm({ locale, email }: { locale: string; email: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initialState);

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Verify your email address</CardTitle>
        <CardDescription>
          We sent a 6-digit verification code to <strong>{email}</strong>. (In local dev, open{" "}
          <code>http://localhost:8025</code> to view Mailpit.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {state.error}
            </p>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>6-digit verification code</span>
            <input
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="123456"
              className="bg-background h-11 rounded-md border px-3 font-mono text-lg tracking-widest"
            />
          </label>

          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Verify email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function GuardianConsentForms({
  locale,
  studentFullName,
}: {
  locale: string;
  studentFullName: string;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    sendGuardianInviteAction,
    initialState,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmGuardianConsentAction,
    initialState,
  );

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Email code to parent / guardian</CardTitle>
          <CardDescription>
            Because {studentFullName} is under 18, India&apos;s DPDP Act 2023 (Section 9) requires
            verifiable parent or legal guardian consent before LOCKIN stores personal academic
            profile or roadmap data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={inviteAction} className="flex flex-col gap-4">
            <input type="hidden" name="locale" value={locale} />
            {inviteState.error && (
              <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {inviteState.error}
              </p>
            )}
            {inviteState.success && (
              <p role="status" className="bg-primary/10 text-primary rounded-md p-3 text-sm">
                {inviteState.success}
              </p>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Parent / guardian full name</span>
              <input
                name="guardianFullName"
                type="text"
                required
                placeholder="Suresh Sharma"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Parent / guardian email</span>
              <input
                name="guardianEmail"
                type="email"
                required
                placeholder="parent@example.com"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Relationship to student</span>
              <input
                name="relationship"
                type="text"
                required
                defaultValue="Parent / Legal Guardian"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>

            <Button type="submit" variant="secondary" disabled={invitePending}>
              {invitePending ? "Sending code…" : "Send 6-digit guardian code"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Guardian confirmation</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to the guardian&apos;s email and complete the consent
            declaration below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={confirmAction} className="flex flex-col gap-4">
            <input type="hidden" name="locale" value={locale} />
            {confirmState.error && (
              <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {confirmState.error}
              </p>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>6-digit guardian OTP</span>
              <input
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="654321"
                className="bg-background h-11 rounded-md border px-3 font-mono text-lg tracking-widest"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Guardian digital signature (type full name)</span>
              <input
                name="guardianFullNameConfirmed"
                type="text"
                required
                placeholder="Suresh Sharma"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>

            <label className="text-muted-foreground flex items-start gap-2.5 text-xs">
              <input name="declarationAccepted" type="checkbox" required className="mt-1 size-4" />
              <span>
                I confirm that I am the parent or legal guardian of {studentFullName} and I grant
                verifiable consent under the DPDP Act 2023 for LOCKIN to store their academic
                profile, branch discovery assessments, and 4-year B.E./B.Tech roadmap. I understand
                I can view or revoke this consent at any time.
              </span>
            </label>

            <Button type="submit" disabled={confirmPending}>
              {confirmPending ? "Recording consent…" : "Approve & unlock student account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentOnboardingForm({
  locale,
  existingProfile,
}: {
  locale: string;
  existingProfile: StudentProfile | null;
}) {
  const [state, action, pending] = useActionState(saveStudentProfileAction, initialState);

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Your Indian Engineering Academic Profile</CardTitle>
        <CardDescription>
          This private profile is protected by Row-Level Security in the <code>student</code>{" "}
          schema. It powers your branch recommendations and 8-semester B.E./B.Tech roadmap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {state.error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Current stage</span>
              <select
                name="educationStage"
                defaultValue={existingProfile?.educationStage ?? "CLASS_12"}
                className="bg-background h-10 rounded-md border px-3 text-sm"
              >
                <option value="CLASS_11">Class 11 / 1st PUC</option>
                <option value="CLASS_12">Class 12 / 2nd PUC</option>
                <option value="DROPPER">Repeater / Dropper Year</option>
                <option value="BTECH_YEAR_1">B.E. / B.Tech — Year 1</option>
                <option value="BTECH_YEAR_2">B.E. / B.Tech — Year 2</option>
                <option value="BTECH_YEAR_3">B.E. / B.Tech — Year 3</option>
                <option value="BTECH_YEAR_4">B.E. / B.Tech — Year 4</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>School / PU Board</span>
              <select
                name="academicBoard"
                defaultValue={existingProfile?.academicBoard ?? "CBSE"}
                className="bg-background h-10 rounded-md border px-3 text-sm"
              >
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE / ISC</option>
                <option value="STATE_KARNATAKA">Karnataka State Board (DPUE)</option>
                <option value="STATE_OTHER">Other State Board</option>
                <option value="IB">IB</option>
                <option value="IGCSE">Cambridge / IGCSE</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Target entrance exams (comma-separated)</span>
            <input
              name="targetExams"
              type="text"
              defaultValue={existingProfile?.targetExams.join(", ") ?? "JEE Main, KCET, COMEDK"}
              placeholder="JEE Main, JEE Advanced, KCET, COMEDK, BITSAT"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Subjects & engineering interests (comma-separated)</span>
            <input
              name="interests"
              type="text"
              defaultValue={existingProfile?.interests.join(", ") ?? ""}
              placeholder="Programming, circuits, robotics, mathematics, thermodynamics"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Preferred states / regions for college (comma-separated)</span>
            <input
              name="preferredStates"
              type="text"
              defaultValue={existingProfile?.preferredStates.join(", ") ?? "Karnataka"}
              placeholder="Karnataka, Tamil Nadu, Maharashtra, All-India"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Career goal or aspiration (optional)</span>
            <textarea
              name="careerGoalSummary"
              rows={3}
              defaultValue={existingProfile?.careerGoalSummary ?? ""}
              placeholder="e.g., Build embedded systems or work in core R&D / software engineering..."
              className="bg-background rounded-md border p-3 text-sm"
            />
          </label>

          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "Saving profile…" : "Save academic profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
