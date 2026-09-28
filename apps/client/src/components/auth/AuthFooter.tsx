interface AuthFooterProps {
  className?: string;
}

export function AuthFooter({ className = "" }: AuthFooterProps) {
  return (
    <footer className={`py-6 text-center text-sm text-gray-400 ${className}`.trim()}>
      <p>© 2024 AI StudyMate. Secure, distraction-free study sanctum.</p>
    </footer>
  );
}

export default AuthFooter;
