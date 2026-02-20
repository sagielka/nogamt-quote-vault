import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleUnsubscribe = async () => {
      if (!email) {
        setErrorMessage("Missing email parameter.");
        setStatus("error");
        return;
      }

      const { error } = await supabase
        .from("unsubscribed_emails")
        .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

      if (error) {
        console.error("Unsubscribe error:", error);
        setErrorMessage("Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
    };

    handleUnsubscribe();
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background rounded-xl shadow-lg p-10 text-center max-w-md w-full">
        {status === "loading" && (
          <>
            <h1 className="text-2xl font-bold text-muted-foreground mb-2">Processing...</h1>
            <p className="text-muted-foreground">Please wait while we process your request.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-green-600 mb-2">✓ Unsubscribed</h1>
            <p className="text-muted-foreground leading-relaxed">
              <strong>{email}</strong> has been unsubscribed. You will no longer receive quotation emails from Noga Engineering & Technology Ltd.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
            <p className="text-muted-foreground leading-relaxed">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
