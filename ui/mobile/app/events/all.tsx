import { Redirect } from "expo-router";

// The full events list now lives on the Events tab (search, date, city,
// filters and tabs). Kept as a redirect so old links keep working.
export default function AllEventsRedirect() {
  return <Redirect href="/(tabs)/events" />;
}
