import Markdown from "react-markdown";
import Link from "next/link";
import React from "react";
import { MeetingGetOne } from "../../types";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpenTextIcon,
  SparklesIcon,
  FileTextIcon,
  FileVideoIcon,
  ClockFadingIcon,
  ListChecksIcon,
  MapIcon,
  CheckCircle2Icon,
  CircleIcon,
  DownloadIcon,
  ArrowLeft,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { formatDuration } from "@/lib/utils";
import { format } from "date-fns";
import { Transcript } from "./transcript";
import { RecapChatProvider } from "./recap-chat-provider";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

interface CompletedStateProps {
  data: MeetingGetOne;
}

export const CompletedState = ({ data }: CompletedStateProps) => {
  const quiz = data.quiz ? JSON.parse(data.quiz) : null;
  const learningPath = data.learningPath ? JSON.parse(data.learningPath) : null;
  const suggestedVideos = data.suggestedVideos
    ? JSON.parse(data.suggestedVideos)
    : null;
  const [selectedOptions, setSelectedOptions] = React.useState<number[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  const [quizMode, setQuizMode] = React.useState<"mcq" | "flashcard">("flashcard");
  const [currentCardIndex, setCurrentCardIndex] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const title = data.name || "Study Session Recap";
      const dateText = data.startedAt ? format(new Date(data.startedAt), "PPP") : "Unknown Date";
      const tutorName = data.agent?.name || "AI Tutor";
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let y = 20;

      const checkPageBreak = (neededHeight: number) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y + neededHeight > pageHeight - margin) {
          doc.addPage();
          y = 20;
          return true;
        }
        return false;
      };

      // Header Banner
      doc.setFillColor(30, 27, 75);
      doc.rect(0, 0, pageWidth, 45, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(title.toUpperCase(), margin, 18, { maxWidth: contentWidth });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Tutor: ${tutorName}   |   Date: ${dateText}   |   Duration: ${data.duration ? formatDuration(data.duration) : "N/A"}`, margin, 35);
      
      y = 55;

      // Summary
      doc.setTextColor(30, 27, 75);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SESSION SUMMARY", margin, y);
      
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;

      doc.setTextColor(55, 65, 81);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      const cleanSummary = (data.summary || "No summary provided.")
        .replace(/[*#_`~[\]]/g, "")
        .trim();

      const summaryLines = doc.splitTextToSize(cleanSummary, contentWidth);
      for (const line of summaryLines) {
        checkPageBreak(6);
        doc.text(line, margin, y);
        y += 5.5;
      }
      y += 10;

      // Learning Path
      if (learningPath && learningPath.length > 0) {
        checkPageBreak(25);
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("PERSONALIZED LEARNING PATH", margin, y);
        
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        doc.setTextColor(55, 65, 81);
        learningPath.forEach((step: any, idx: number) => {
          checkPageBreak(22);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(`${idx + 1}. ${step.title || "Next Step"}`, margin, y);
          y += 5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          const descLines = doc.splitTextToSize(step.description || "", contentWidth - 10);
          for (const line of descLines) {
            checkPageBreak(5);
            doc.text(line, margin + 5, y);
            y += 4.5;
          }
          y += 4;
        });
        y += 8;
      }

      // Quiz/Flashcards
      if (quiz && quiz.length > 0) {
        checkPageBreak(25);
        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("FLASHCARDS & QUIZ RECAP", margin, y);
        
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        doc.setTextColor(55, 65, 81);
        quiz.forEach((q: any, idx: number) => {
          checkPageBreak(18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10.5);
          doc.text(`Q${idx + 1}: ${q.question}`, margin, y);
          y += 5.5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const answerText = `Answer: ${q.options[q.correctAnswer]}`;
          doc.text(answerText, margin + 5, y);
          y += 6.5;
        });
        y += 8;
      }

      // Whiteboard Snapshot
      if (data.whiteboardSnapshot) {
        checkPageBreak(120);
        doc.setTextColor(168, 85, 247);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("FINAL WHITEBOARD SNAPSHOT", margin, y);
        
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        const imgData = data.whiteboardSnapshot.startsWith("data:")
          ? data.whiteboardSnapshot
          : `data:image/png;base64,${data.whiteboardSnapshot}`;

        doc.addImage(imgData, "PNG", margin, y, contentWidth, 95);
        y += 105;
      }

      doc.save(`lumina-study-guide-${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
      toast.success("Study guide PDF downloaded!");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to generate study guide PDF");
    }
  };

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    const newSelected = [...selectedOptions];
    newSelected[questionIndex] = optionIndex;
    setSelectedOptions(newSelected);
  };

  const handleExportFlashcards = () => {
    if (!quiz) return;

    // Format: Front, Back
    // For Anki: "Question","Answer"
    const csvContent = quiz
      .map((q: any) => {
        const question = q.question.replace(/"/g, '""');
        const answer = q.options[q.correctAnswer].replace(/"/g, '""');
        return `"${question}","${answer}"`;
      })
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `lumina-ai-flashcards-${data.name.toLowerCase().replace(/\s+/g, "-")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex flex-col gap-y-4">
        <Tabs defaultValue="summary">
          <div className="bg-white rounded-lg shadow-md px-3 border">
            <ScrollArea>
              <TabsList className="p-0 bg-background justify-start rounded-none h-13">
                <TabsTrigger
                  value="summary"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <BookOpenTextIcon />
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="quiz"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <ListChecksIcon />
                  Quiz
                </TabsTrigger>
                <TabsTrigger
                  value="path"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <MapIcon />
                  Next Steps
                </TabsTrigger>
                <TabsTrigger
                  value="videos"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <FileVideoIcon />
                  Suggested Videos
                </TabsTrigger>
                <TabsTrigger
                  value="transcript"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <FileTextIcon />
                  Transcript
                </TabsTrigger>
                <TabsTrigger
                  value="recording"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <FileVideoIcon />
                  Recording
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="text-muted-foreground rounded-none bg-background data-[state=active]:shadow-none border-b-2 border-transparent data-[state-active]:border-b-primary data-[state-active]:text-accent-foreground h-full hover:text-accent-foreground"
                >
                  <SparklesIcon />
                  Ask AI
                </TabsTrigger>
              </TabsList>
            </ScrollArea>
          </div>
          <TabsContent value="recording">
            <div className="bg-white rounded-lg border px-4 py-5 ">
              <video
                src={data.recordingUrl!}
                className="w-full rounded-lg"
                controls
              ></video>
            </div>
          </TabsContent>
          <TabsContent value="chat">
            <RecapChatProvider
              meetingId={data.id}
              meetingName={data.name}
              agentName={data.agent?.name}
              agentId={data.agent?.id}
            />
          </TabsContent>
          <TabsContent value="transcript">
            <Transcript meetingId={data.id} />
          </TabsContent>
          <TabsContent value="videos">
            <div className="bg-white rounded-lg border p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xl font-bold text-red-600">
                <FileVideoIcon className="size-6" />
                <h2>Suggested Videos</h2>
              </div>
              <p className="text-muted-foreground">
                Hand-picked educational videos to help you understand these
                concepts better:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                {suggestedVideos?.map((video: any, i: number) => (
                  <Link
                    key={i}
                    href={video.url}
                    target="_blank"
                    className="group flex flex-col gap-3 p-3 rounded-2xl border bg-gray-50/50 hover:bg-white hover:shadow-xl hover:border-red-200 transition-all duration-300"
                  >
                    <div className="relative aspect-video overflow-hidden rounded-xl border">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                        <div className="size-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <FileVideoIcon className="size-6 fill-current" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-red-700 transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        View on YouTube
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="path">
            <div className="bg-white rounded-lg border p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xl font-bold text-emerald-600">
                <MapIcon className="size-6" />
                <h2>Personalized Learning Path</h2>
              </div>
              <p className="text-muted-foreground">
                Based on your session, here are the recommended next steps to
                master this topic:
              </p>
              <div className="grid gap-4 mt-2">
                {learningPath?.map((step: any, i: number) => (
                  <div
                    key={i}
                    className="flex gap-4 p-4 rounded-xl border bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900">
                        {step.title}
                      </h3>
                      <p className="text-emerald-800/70 text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="quiz">
            <div className="bg-white rounded-lg border p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2 text-xl font-bold text-blue-600">
                  <ListChecksIcon className="size-6" />
                  <h2>Practice Room</h2>
                </div>
                
                {/* Mode Selector Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setQuizMode("flashcard")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      quizMode === "flashcard"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    🎴 Flashcards
                  </button>
                  <button
                    onClick={() => setQuizMode("mcq")}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      quizMode === "mcq"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    📝 Multiple Choice
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {quiz && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportFlashcards}
                      className="flex items-center gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-bold"
                    >
                      <DownloadIcon className="size-4" />
                      Export to Anki
                    </Button>
                  )}
                </div>
              </div>

              {!quiz ? (
                <div className="py-12 text-center text-muted-foreground">
                  No quiz/flashcards available for this session.
                </div>
              ) : quizMode === "flashcard" ? (
                /* Interactive 3D Flashcards Flip Deck */
                <div className="flex flex-col items-center gap-6 py-6 max-w-lg mx-auto w-full">
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className={`flip-card ${isFlipped ? "flipped" : ""}`}
                  >
                    <div className="flip-card-inner">
                      {/* Front Side */}
                      <div className="flip-card-front">
                        <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 mb-6">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Question {currentCardIndex + 1} of {quiz.length}</span>
                          <span className="text-xs">🤔</span>
                        </div>
                        <p className="text-lg font-bold text-center leading-relaxed flex-1 flex items-center justify-center">
                          {quiz[currentCardIndex].question}
                        </p>
                        <div className="mt-6 text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                          <RotateCw className="size-3 animate-pulse" /> Click to Flip Card
                        </div>
                      </div>
                      
                      {/* Back Side */}
                      <div className="flip-card-back">
                        <div className="w-full flex items-center justify-between border-b border-purple-500/20 pb-3 mb-6">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400">Correct Answer</span>
                          <span className="text-xs">💡</span>
                        </div>
                        <p className="text-base font-bold text-center leading-relaxed text-zinc-100 flex-1 flex items-center justify-center">
                          {quiz[currentCardIndex].options[quiz[currentCardIndex].correctAnswer]}
                        </p>
                        <div className="mt-6 text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                          <RotateCw className="size-3" /> Click to Flip Back
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center justify-between w-full mt-4 px-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentCardIndex === 0}
                      onClick={() => {
                        setIsFlipped(false);
                        setTimeout(() => setCurrentCardIndex(prev => prev - 1), 150);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <ArrowLeft className="size-4" /> Previous
                    </Button>
                    
                    <span className="text-sm font-semibold text-zinc-500">
                      {currentCardIndex + 1} / {quiz.length}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentCardIndex === quiz.length - 1}
                      onClick={() => {
                        setIsFlipped(false);
                        setTimeout(() => setCurrentCardIndex(prev => prev + 1), 150);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      Next <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                /* Multiple Choice Quiz */
                <div className="flex flex-col gap-8">
                  {quiz.map((q: any, i: number) => (
                    <div key={i} className="flex flex-col gap-4">
                      <h3 className="text-lg font-semibold flex gap-2">
                        <span className="text-blue-500">{i + 1}.</span>
                        {q.question}
                      </h3>
                      <div className="grid gap-2">
                        {q.options.map((option: string, oi: number) => {
                          const isSelected = selectedOptions[i] === oi;
                          const isCorrect = q.correctAnswer === oi;
                          const showCorrect = showResults && isCorrect;
                          const showWrong = showResults && isSelected && !isCorrect;

                          return (
                            <button
                              key={oi}
                              disabled={showResults}
                              onClick={() => handleOptionSelect(i, oi)}
                              className={`
                                flex items-center justify-between p-4 rounded-xl border text-left transition-all
                                ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200"}
                                ${showCorrect ? "border-emerald-500 bg-emerald-50 text-emerald-900" : ""}
                                ${showWrong ? "border-red-500 bg-red-50 text-red-900" : ""}
                              `}
                            >
                              <span>{option}</span>
                              {showCorrect && (
                                <CheckCircle2Icon className="size-5 text-emerald-600" />
                              )}
                              {showWrong && (
                                <CircleIcon className="size-5 text-red-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {!showResults ? (
                    <Button
                      className="mt-4 bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                      onClick={() => setShowResults(true)}
                      disabled={selectedOptions.length < quiz.length}
                    >
                      Check Answers
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-4 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      onClick={() => {
                        setShowResults(false);
                        setSelectedOptions([]);
                      }}
                    >
                      Retry Quiz
                    </Button>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="summary">
            <div className="bg-white rounded-lg border">
              <div className="px-6 py-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold capitalize mb-1">
                      {data.name}
                    </h2>
                    <div className="flex flex-wrap gap-3 items-center">
                      <Link
                        href={`/dashboard/tutor/${data.agent.id}`}
                        className="flex items-center gap-x-2 underline underline-offset-2 capitalize font-medium text-base hover:text-indigo-600 transition-colors"
                      >
                        <GeneratedAvatar
                          variant="botttsNeutral"
                          seed={data.agent.name}
                          className="size-6"
                        />
                        {data.agent.name}
                      </Link>
                      <Badge variant="secondary" className="text-xs">
                        {data.startedAt
                          ? format(data.startedAt, "PPP")
                          : "Unknown date"}
                      </Badge>
                      <Badge
                        className="flex items-center gap-x-2 text-xs"
                        variant="outline"
                      >
                        <ClockFadingIcon className="text-blue-700 size-4" />
                        {data.duration
                          ? formatDuration(data.duration)
                          : "Unknown duration"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition-all self-start md:self-center"
                  >
                    <DownloadIcon className="size-4" />
                    Download Study Guide (PDF)
                  </Button>
                </div>
                <div className="flex items-center gap-x-2 mb-2 mt-2">
                  <SparklesIcon className="size-4 text-yellow-500" />
                  <span className="font-semibold text-base">
                    General Summary
                  </span>
                </div>
                <div className="bg-gray-50 rounded-md p-5 shadow-inner">
                  <Markdown
                    components={{
                      h1: (props) => (
                        <h1 className="text-2xl font-bold mb-4" {...props} />
                      ),
                      h2: (props) => (
                        <h2 className="text-xl font-semibold mb-3" {...props} />
                      ),
                      h3: (props) => (
                        <h3 className="text-lg font-medium mb-2" {...props} />
                      ),
                      h4: (props) => (
                        <h4 className="text-base font-medium mb-2" {...props} />
                      ),
                      p: (props) => (
                        <p className="mb-4 leading-relaxed" {...props} />
                      ),
                      ul: (props) => (
                        <ul className="list-disc list-inside mb-4" {...props} />
                      ),
                      ol: (props) => (
                        <ol
                          className="list-decimal list-inside mb-4"
                          {...props}
                        />
                      ),
                      li: (props) => <li className="mb-1" {...props} />,
                      strong: (props) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      code: (props) => (
                        <code
                          className="bg-gray-100 px-1 py-0.5 rounded text-sm"
                          {...props}
                        />
                      ),
                      blockquote: (props) => (
                        <blockquote
                          className="border-l-4 border-gray-300 pl-4 italic mb-4"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {data.summary}
                  </Markdown>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};
