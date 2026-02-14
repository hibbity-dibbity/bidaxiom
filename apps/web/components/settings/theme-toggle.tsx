"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-32" />;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize how the application looks
          </p>
        </div>

        <div>
          <Label>Theme</Label>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="mt-3 space-y-3"
          >
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="light" id="light" />
              <Sun className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="light" className="font-medium cursor-pointer">
                  Light
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use light theme regardless of system settings
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="dark" id="dark" />
              <Moon className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="dark" className="font-medium cursor-pointer">
                  Dark
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use dark theme regardless of system settings
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
              <RadioGroupItem value="system" id="system" />
              <Monitor className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="system" className="font-medium cursor-pointer">
                  System
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically adjust theme based on system preferences
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>
    </Card>
  );
}
