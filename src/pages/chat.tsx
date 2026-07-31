import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ArrowDown,
  Building2,
  LogOut,
  User,
  Phone,
  Headphones,
  Menu,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { OrgPicker } from "@/components/OrgPicker";
import { NotificationPopover } from "@/components/NotificationPopover";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatInput } from "@/components/ChatInput";
import { displayName } from "@/lib/chat-utils";
import { useChatPage } from "@/hooks/useChatPage";

export default function ChatPage() {
  const {
    setLocation,
    user,
    logout,
    displayUserName,
    orgDisplayName,
    isSuperAdmin,
    selectedOrg,
    needsOrgSelection,
    handleOrgSelect,
    handleSwitchOrg,
    notificationsList,
    unreadCount,
    showNotifications,
    setShowNotifications,
    markNotifRead,
    markAllRead,
    dismissNotif,
    mobile,
    listSearch,
    setListSearch,
    isLoadingLogs,
    filteredLogs,
    totalCount,
    selectedId,
    setSelectedId,
    selectedChat,
    humanRequested,
    displayMessages,
    transcriptSearch,
    setTranscriptSearch,
    currentMatchIndex,
    searchMatches,
    totalMatches,
    goToNextMatch,
    goToPrevMatch,
    showScrollButton,
    setShouldAutoScroll,
    scrollToBottom,
    message,
    setMessage,
    isSending,
    pendingAttachments,
    removeAttachment,
    handleFileSelect,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    sendMessage,
    messagesEndRef,
    chatContainerRef,
    messageRefs,
    imageInputRef,
    documentInputRef,
  } = useChatPage();

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (needsOrgSelection) {
    return <OrgPicker onSelect={handleOrgSelect} onLogout={() => logout()} />;
  }

  const showConvo = !!selectedId;

  return (
    <div className="h-screen w-full flex flex-col bg-background font-sans overflow-hidden">
      {/* ── Header ── */}
      <header
        className={`h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 ${mobile ? "hidden" : ""}`}
      >
        <div className="flex items-center gap-3">
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <Logo className="w-6 h-6 object-contain shrink-0" />
          <span className="hidden lg:block font-bold text-primary font-['Plus_Jakarta_Sans'] text-base tracking-tight">
            Chat Angel AI
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {orgDisplayName && (
            <button
              onClick={isSuperAdmin && selectedOrg ? handleSwitchOrg : undefined}
              className={`hidden sm:flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-sm font-medium transition-colors ${
                isSuperAdmin && selectedOrg
                  ? "hover:bg-primary/10 hover:text-primary cursor-pointer"
                  : "cursor-default"
              }`}
            >
              <span className="max-w-[160px] truncate">{orgDisplayName}</span>
              {isSuperAdmin && selectedOrg && (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          )}

          <NotificationPopover
            open={showNotifications}
            onOpenChange={setShowNotifications}
            notifications={notificationsList}
            unreadCount={unreadCount}
            onMarkRead={markNotifRead}
            onMarkAllRead={markAllRead}
            onDismiss={dismissNotif}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-9 w-9 rounded-full border-2 border-border hover:border-primary hover:ring-2 hover:ring-primary/20 transition-colors overflow-hidden shrink-0"
                aria-label="User menu"
              >
                <Avatar className="h-full w-full">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    {getInitials(displayUserName || "U")}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold truncate">{displayUserName}</p>
                {(user as any).email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {(user as any).email}
                  </p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {isSuperAdmin && selectedOrg && (
                <DropdownMenuItem onClick={handleSwitchOrg}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Switch Organisation
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main body ── */}
      <main className="flex-1 flex overflow-hidden">
        <ChatSidebar
          showConvo={showConvo}
          mobile={mobile}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
          isLoading={isLoadingLogs}
          chats={filteredLogs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          totalCount={totalCount}
        />

        {/* ── Right panel: Conversation ── */}
        <section
          className={`bg-background flex-col min-w-0 ${
            showConvo ? "flex flex-1" : "hidden md:flex md:flex-1"
          }`}
        >
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
              <div className="bg-card p-5 md:p-6 rounded-full shadow-sm mb-4">
                <Logo className="w-10 h-10 md:w-12 md:h-12 object-contain opacity-80" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-foreground font-['Plus_Jakarta_Sans'] mb-2">
                No Conversation Selected
              </h3>
              <p className="text-sm text-center">
                Select a conversation from the left to view messages
              </p>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="bg-card border-b border-border px-3 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 shrink-0 shadow-sm z-10">
                {!mobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden -ml-1 shrink-0"
                    onClick={() => setSelectedId(null)}
                    aria-label="Back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                )}
                <Avatar className="h-10 w-10 md:h-12 md:w-12 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-base md:text-lg">
                    {getInitials(displayName(selectedChat))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base md:text-xl font-semibold font-['Plus_Jakarta_Sans'] text-foreground truncate">
                      {displayName(selectedChat)}
                    </h2>
                    {humanRequested && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 text-xs font-medium rounded-full shrink-0">
                        <Headphones className="w-3 h-3" />
                        Human Requested
                      </span>
                    )}
                  </div>
                  {selectedChat.recipientNumber && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="w-3 h-3 shrink-0" />
                      {selectedChat.recipientNumber.replace(
                        /^\d{8}/,
                        (match) => "*".repeat(match.length),
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Transcript search bar */}
              <div className="bg-card border-b border-border px-3 md:px-4 py-2 md:py-2.5 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search transcript"
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pr-9 text-sm h-9"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {totalMatches > 0 && (
                    <div className="flex items-center gap-0.5 bg-muted rounded-lg px-1.5 py-1">
                      <span className="text-xs font-medium whitespace-nowrap px-1">
                        {currentMatchIndex + 1}/{totalMatches}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={goToPrevMatch}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={goToNextMatch}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 relative overflow-hidden flex flex-col">
                <div
                  ref={chatContainerRef}
                  className="flex-1 px-3 md:px-4 py-3 md:py-4 overflow-y-auto scroll-smooth bg-background"
                >
                  <div className="space-y-3 max-w-3xl mx-auto">
                    {displayMessages.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No messages in this conversation.
                      </div>
                    ) : (
                      displayMessages.map((msg) => (
                        <div
                          key={msg.id}
                          ref={(el) => {
                            messageRefs.current[msg.id] = el;
                          }}
                        >
                          <MessageBubble
                            msg={msg}
                            isCurrentSearchMatch={
                              searchMatches[currentMatchIndex]?.id === msg.id
                            }
                            searchQuery={transcriptSearch.trim()}
                          />
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {showScrollButton && (
                  <button
                    onClick={() => {
                      setShouldAutoScroll(true);
                      scrollToBottom("smooth");
                    }}
                    className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90 transition-all animate-in fade-in slide-in-from-bottom-2 z-10"
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              <ChatInput
                humanRequested={humanRequested}
                pendingAttachments={pendingAttachments}
                onRemoveAttachment={removeAttachment}
                isRecording={isRecording}
                recordingDuration={recordingDuration}
                onStopRecording={stopRecording}
                onStartRecording={startRecording}
                message={message}
                onMessageChange={setMessage}
                onSend={sendMessage}
                isSending={isSending}
                imageInputRef={imageInputRef}
                documentInputRef={documentInputRef}
                onImageFileSelect={handleFileSelect("image")}
                onDocumentFileSelect={handleFileSelect("document")}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
