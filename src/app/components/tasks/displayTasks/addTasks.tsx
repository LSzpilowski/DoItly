import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TasksHistory } from "./tasksHistory";
import { TemplateSheet } from "./templateSheet";
import type { Task } from "@/store/tasksStore";

interface IAddTasks {
  inputValue: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  historyTasks: Task[];
  handleClearHistory: () => void;
  handleReUseButton: (task: Task) => void;
}

export const AddTasks = ({
  inputValue,
  handleChange,
  handleSubmit,
  historyTasks,
  handleClearHistory,
  handleReUseButton,
}: IAddTasks) => {
  return (
    <Card className="flex flex-row justify-center items-center gap-3 md:gap-4 py-4 px-4 md:px-6 border-2 shadow-lg">
      <div className="hidden md:flex items-center gap-3">
        <TemplateSheet />
        <TasksHistory
          latestHistoryTasks={historyTasks}
          handleClearHistory={handleClearHistory}
          handleReUseButton={handleReUseButton}
        />
      </div>
      <form
        autoComplete="off"
        onSubmit={handleSubmit}
        className="flex flex-row gap-2 md:gap-3 w-full md:w-auto"
      >
        <Input
          id="task-input"
          name="task"
          type="text"
          placeholder="What's on your mind today?"
          minLength={3}
          maxLength={70}
          required={true}
          value={inputValue}
          onChange={handleChange}
          className="text-base md:text-lg md:w-96 h-11 px-4"
          aria-label="Enter new task"
        />
        <Button 
          type="submit" 
          className="h-11 px-6 font-medium bg-black/50 dark:bg-white text-white dark:text-black hover:bg-black/70 dark:hover:bg-white/90"
          aria-label="Add new task"
        >
          Add Task
        </Button>
      </form>
    </Card>
  );
};
