/**
 * AuthWizard.jsx
 * Multi-step auth container with framer-motion page transitions.
 * Manages shared state (email, verified status) across all steps.
 *
 * Steps: welcome → signup-otp → create-password → role-select
 *        → customer-profile | vendor-profile
 *        login (separate path from welcome)
 */

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import WelcomeScreen        from "./WelcomeScreen";
import SignUpOTPScreen      from "./SignUpOTPScreen";
import CreatePasswordScreen from "./CreatePasswordScreen";
import RoleSelectionScreen  from "./RoleSelectionScreen";
import CustomerProfileScreen from "./CustomerProfileScreen";
import VendorProfileScreen  from "./VendorProfileScreen";
import LoginScreen          from "./LoginScreen";

// Slide direction: 1 = forward, -1 = backward
const variants = {
  enter:  (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

export default function AuthWizard({ onDone }) {
  const [step,      setStep]      = useState("welcome");
  const [direction, setDirection] = useState(1);

  // Shared wizard state
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [role,          setRole]          = useState(null); // "consumer" | "vendor"

  function go(nextStep, dir = 1) {
    setDirection(dir);
    setStep(nextStep);
  }

  const screens = {
    welcome: (
      <WelcomeScreen
        onSignUp={() => go("signup-otp")}
        onLogin={() => go("login")}
        onGuest={onDone}
      />
    ),
    login: (
      <LoginScreen
        onDone={onDone}
        onBack={() => go("welcome", -1)}
      />
    ),
    "signup-otp": (
      <SignUpOTPScreen
        onVerified={(email) => { setVerifiedEmail(email); go("create-password"); }}
        onBack={() => go("welcome", -1)}
      />
    ),
    "create-password": (
      <CreatePasswordScreen
        email={verifiedEmail}
        onDone={() => go("role-select")}
        onBack={() => go("signup-otp", -1)}
      />
    ),
    "role-select": (
      <RoleSelectionScreen
        onSelect={(r) => { setRole(r); go(r === "consumer" ? "customer-profile" : "vendor-profile"); }}
        onBack={() => go("create-password", -1)}
      />
    ),
    "customer-profile": (
      <CustomerProfileScreen
        onDone={onDone}
        onBack={() => go("role-select", -1)}
      />
    ),
    "vendor-profile": (
      <VendorProfileScreen
        onDone={onDone}
        onBack={() => go("role-select", -1)}
      />
    ),
  };

  return (
    <div className="min-h-screen bg-[#0A0E14] overflow-hidden relative">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className="absolute inset-0 overflow-y-auto"
        >
          {screens[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
