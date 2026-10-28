export type RootStackParamList = {
  MainTabs: undefined;
};

export type MainTabParamList = {
  Home: { postId?: string } | undefined;
  Discover: undefined;
  Upload: undefined;
  Inbox: { contactId?: string } | undefined;
  Profile: { username?: string } | undefined;
};
