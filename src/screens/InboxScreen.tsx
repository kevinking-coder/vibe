import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { Avatar, Button, colors, EmptyState, Field, Heading, Screen } from "../components/ui";
import { supabase } from "../services/supabase";
import type { UserProfile } from "../types/app";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
type Contact = Pick<UserProfile, "id" | "username" | "display_name" | "avatar_url">;
type Conversation = { contact: Contact; lastMessage: Message };

export function InboxScreen({
  session,
}: {
  session: Session;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [choosingContact, setChoosingContact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    setError(null);
    try {
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false })
        .limit(250);
      if (messagesError) throw messagesError;
      const latest = new Map<string, Message>();
      for (const message of (messages ?? []) as Message[]) {
        const otherId = message.sender_id === session.user.id ? message.recipient_id : message.sender_id;
        if (!latest.has(otherId)) latest.set(otherId, message);
      }

      const ids = [...latest.keys()];
      if (ids.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      if (usersError) throw usersError;
      const byId = new Map(((users ?? []) as Contact[]).map((user) => [user.id, user]));
      setConversations(
        [...latest.entries()]
          .map(([id, lastMessage]) => ({ contact: byId.get(id), lastMessage }))
          .filter((entry): entry is Conversation => Boolean(entry.contact)),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Inbox could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  const loadContacts = useCallback(async () => {
    try {
      const [usersResult, blockedResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, display_name, avatar_url")
          .neq("id", session.user.id)
          .order("username")
          .limit(100),
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", session.user.id),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (blockedResult.error) throw blockedResult.error;
      const blocked = new Set((blockedResult.data ?? []).map((item) => item.blocked_id));
      setContacts(((usersResult.data ?? []) as Contact[]).filter((user) => !blocked.has(user.id)));
      setChoosingContact(true);
    } catch (contactsError) {
      Alert.alert("Could not load people", contactsError instanceof Error ? contactsError.message : "Please try again.");
    }
  }, [session.user.id]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  if (selected) {
    return (
      <Thread
        session={session}
        contact={selected}
        onBack={() => { setSelected(null); void loadInbox(); }}
      />
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Heading title="Inbox" subtitle="Your conversations, all in one place." />
          <Button onPress={() => void loadContacts()} style={styles.newButton}>
            <Text style={styles.newButtonText}>＋</Text>
          </Button>
        </View>
        {choosingContact ? (
          <View style={styles.contactPicker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.sectionTitle}>New message</Text>
              <Pressable onPress={() => setChoosingContact(false)}><Text style={styles.close}>Close</Text></Pressable>
            </View>
            <FlatList
              data={contacts}
              keyExtractor={(item) => item.id}
              style={styles.contactList}
              renderItem={({ item }) => (
                <Pressable style={styles.contactRow} onPress={() => { setSelected(item); setChoosingContact(false); }}>
                  <Avatar uri={item.avatar_url} label={item.display_name || item.username} />
                  <View>
                    <Text style={styles.name}>{item.display_name || item.username}</Text>
                    <Text style={styles.handle}>@{item.username}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : null}
        {error ? (
          <EmptyState title="Inbox unavailable" body={error} action={<Button onPress={() => void loadInbox()}>Try again</Button>} />
        ) : loading ? (
          <EmptyState title="Loading messages…" body="Fetching your conversations." />
        ) : conversations.length === 0 ? (
          <EmptyState
            title="Your inbox is a blank canvas"
            body="Say hi to someone whose vibe you like."
            action={<Button onPress={() => void loadContacts()}>Start a conversation</Button>}
          />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.contact.id}
            contentContainerStyle={styles.conversationList}
            renderItem={({ item }) => (
              <Pressable style={styles.conversation} onPress={() => setSelected(item.contact)}>
                <Avatar uri={item.contact.avatar_url} label={item.contact.display_name || item.contact.username} size={50} />
                <View style={styles.conversationText}>
                  <Text style={styles.name}>{item.contact.display_name || item.contact.username}</Text>
                  <Text numberOfLines={1} style={styles.preview}>
                    {item.lastMessage.sender_id === session.user.id ? "You: " : ""}
                    {item.lastMessage.body}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

function Thread({
  session,
  contact,
  onBack,
}: {
  session: Session;
  contact: Contact;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const loadMessages = useCallback(async () => {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${session.user.id},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${session.user.id})`,
      )
      .order("created_at", { ascending: true })
      .limit(300);
    if (loadError) {
      setError(loadError.message);
    } else {
      const next = (data ?? []) as Message[];
      setMessages(next);
      const unreadIds = next
        .filter((message) => message.recipient_id === session.user.id && !message.read_at)
        .map((message) => message.id);
      if (unreadIds.length) {
        const { error: readError } = await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds)
          .eq("recipient_id", session.user.id);
        if (readError) Alert.alert("Could not mark messages read", readError.message);
      }
    }
    setLoading(false);
  }, [contact.id, session.user.id]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { error: sendError } = await supabase.from("messages").insert({
        sender_id: session.user.id,
        recipient_id: contact.id,
        body: text,
      });
      if (sendError) throw sendError;
      setBody("");
      await loadMessages();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (sendError) {
      Alert.alert("Message not sent", sendError instanceof Error ? sendError.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.thread}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
      >
        <View style={styles.threadHeader}>
          <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <Avatar uri={contact.avatar_url} label={contact.display_name || contact.username} size={38} />
          <View style={styles.headerName}>
            <Text style={styles.name}>{contact.display_name || contact.username}</Text>
            <Text style={styles.handle}>@{contact.username}</Text>
          </View>
        </View>
        {error ? (
          <EmptyState title="Conversation unavailable" body={error} action={<Button onPress={() => void loadMessages()}>Try again</Button>} />
        ) : loading ? (
          <EmptyState title="Opening conversation…" body="Loading messages." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={styles.firstMessage}>Say hello to {contact.display_name || contact.username}.</Text>}
            renderItem={({ item }) => {
              const own = item.sender_id === session.user.id;
              return (
                <View style={[styles.bubble, own ? styles.ownBubble : styles.theirBubble]}>
                  <Text style={styles.messageText}>{item.body}</Text>
                  <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
          />
        )}
        <View style={styles.composer}>
          <Field
            value={body}
            onChangeText={setBody}
            placeholder="Write a message…"
            multiline
            maxLength={4000}
            style={styles.messageInput}
          />
          <Button loading={sending} disabled={!body.trim()} onPress={() => void send()} style={styles.sendButton}>
            <Text style={styles.sendText}>↑</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  newButton: { width: 42, minHeight: 42, paddingHorizontal: 0, borderRadius: 14 },
  newButtonText: { color: colors.text, fontSize: 24, lineHeight: 27 },
  conversationList: { gap: 7, paddingBottom: 18 },
  conversation: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.panel },
  conversationText: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  handle: { color: colors.muted, fontSize: 12 },
  preview: { color: colors.muted, fontSize: 13, marginTop: 2 },
  chevron: { color: colors.muted, fontSize: 24 },
  contactPicker: { maxHeight: 260, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  close: { color: colors.mint, fontWeight: "700" },
  contactList: { flexGrow: 0 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  thread: { flex: 1 },
  threadHeader: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderColor: colors.border },
  back: { width: 30, alignItems: "center" },
  backText: { color: colors.text, fontSize: 34, lineHeight: 38 },
  headerName: { gap: 3 },
  messageList: { flexGrow: 1, justifyContent: "flex-end", padding: 14, gap: 8 },
  firstMessage: { color: colors.muted, textAlign: "center", marginVertical: 18 },
  bubble: { maxWidth: "82%", padding: 11, borderRadius: 16, gap: 4 },
  ownBubble: { alignSelf: "flex-end", backgroundColor: "#482567", borderBottomRightRadius: 5 },
  theirBubble: { alignSelf: "flex-start", backgroundColor: colors.panelRaised, borderBottomLeftRadius: 5 },
  messageText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  time: { alignSelf: "flex-end", color: "#C4B5FD", fontSize: 10 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderColor: colors.border },
  messageInput: { flex: 1, minHeight: 45, maxHeight: 120, paddingTop: 12 },
  sendButton: { width: 46, minHeight: 46, paddingHorizontal: 0, borderRadius: 16 },
  sendText: { color: colors.text, fontSize: 22, fontWeight: "800" },
});
