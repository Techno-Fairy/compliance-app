import { Redirect } from "expo-router";

export default function Root() {
  // TODO: read token from SecureStore to redirect authenticated users to (tabs)
  return <Redirect href="/(auth)/login" />;
}
