import { Redirect } from "expo-router";

export default function Root() {
  // Send user to login screen
  return <Redirect href="/(auth)/login" />;
}