
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import type { Prompt, CreatePromptInput, UpdatePromptInput, ExecutionHistory, ExecutePromptInput } from '../../server/src/schema';

function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('prompts');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);

  // Form state for creating/editing prompts
  const [formData, setFormData] = useState<CreatePromptInput>({
    name: '',
    description: null,
    prompt_text: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: null,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    destination_webhook_url: '',
    cron_schedule: null,
    is_active: true
  });

  // Manual execution form data
  const [executeData, setExecuteData] = useState('{}');

  const loadPrompts = useCallback(async () => {
    try {
      const result = await trpc.getPrompts.query();
      setPrompts(result);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  }, []);

  const loadExecutionHistory = useCallback(async () => {
    try {
      const result = await trpc.getExecutionHistory.query({});
      setExecutionHistory(result);
    } catch (error) {
      console.error('Failed to load execution history:', error);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
    loadExecutionHistory();
  }, [loadPrompts, loadExecutionHistory]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: null,
      prompt_text: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      max_tokens: null,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      destination_webhook_url: '',
      cron_schedule: null,
      is_active: true
    });
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await trpc.createPrompt.mutate(formData);
      setPrompts((prev: Prompt[]) => [...prev, response]);
      resetForm();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrompt) return;
    
    setIsLoading(true);
    try {
      const updateData: UpdatePromptInput = {
        id: selectedPrompt.id,
        ...formData
      };
      const response = await trpc.updatePrompt.mutate(updateData);
      setPrompts((prev: Prompt[]) => 
        prev.map((p: Prompt) => p.id === selectedPrompt.id ? response : p)
      );
      setIsEditDialogOpen(false);
      setSelectedPrompt(null);
    } catch (error) {
      console.error('Failed to update prompt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePrompt = async (id: number) => {
    try {
      await trpc.deletePrompt.mutate({ id });
      setPrompts((prev: Prompt[]) => prev.filter((p: Prompt) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const handleExecutePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrompt) return;

    setIsExecuting(true);
    try {
      let templateData = {};
      if (executeData.trim()) {
        templateData = JSON.parse(executeData);
      }

      const executionInput: ExecutePromptInput = {
        prompt_id: selectedPrompt.id,
        template_data: templateData
      };

      await trpc.executePrompt.mutate(executionInput);
      setIsExecuteDialogOpen(false);
      setExecuteData('{}');
      await loadExecutionHistory(); // Refresh history
    } catch (error) {
      console.error('Failed to execute prompt:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const openEditDialog = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      name: prompt.name,
      description: prompt.description,
      prompt_text: prompt.prompt_text,
      model: prompt.model,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
      top_p: prompt.top_p,
      frequency_penalty: prompt.frequency_penalty,
      presence_penalty: prompt.presence_penalty,
      destination_webhook_url: prompt.destination_webhook_url,
      cron_schedule: prompt.cron_schedule,
      is_active: prompt.is_active
    });
    setIsEditDialogOpen(true);
  };

  const openExecuteDialog = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setExecuteData('{}');
    setIsExecuteDialogOpen(true);
  };

  const cronScheduleOptions = [
    { value: '0 * * * *', label: 'Every hour' },
    { value: '0 0 * * *', label: 'Daily at midnight' },
    { value: '0 9 * * *', label: 'Daily at 9 AM' },
    { value: '0 0 * * 0', label: 'Weekly (Sunday)' },
    { value: '0 0 1 * *', label: 'Monthly (1st)' }
  ];

  const modelOptions = [
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-turbo-preview',
    'gpt-4o',
    'gpt-4o-mini'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2">🤖 LLM CRON Scheduler</h1>
          <p className="text-lg text-indigo-700">Automate your AI prompts with scheduling and webhooks</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="prompts">📝 Prompts</TabsTrigger>
            <TabsTrigger value="history">📊 Execution History</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">Prompt Management</h2>
                <p className="text-gray-600">Create and manage your AI prompts with scheduling</p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    ➕ Create New Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Create New Prompt</DialogTitle>
                    <DialogDescription>
                      Set up a new AI prompt with scheduling and webhook configuration
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[70vh] pr-4">
                    <form onSubmit={handleCreatePrompt} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Prompt Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setFormData((prev: CreatePromptInput) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="My AI Prompt"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model">AI Model</Label>
                          <Select 
                            value={formData.model || 'gpt-3.5-turbo'} 
                            onValueChange={(value: string) =>
                              setFormData((prev: CreatePromptInput) => ({ ...prev, model: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {modelOptions.map((model: string) => (
                                <SelectItem key={model} value={model}>{model}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={formData.description || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setFormData((prev: CreatePromptInput) => ({ 
                              ...prev, 
                              description: e.target.value || null 
                            }))
                          }
                          placeholder="Brief description of this prompt"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="prompt_text">Prompt Text * (Supports Liquid templating)</Label>
                        <Textarea
                          id="prompt_text"
                          value={formData.prompt_text}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setFormData((prev: CreatePromptInput) => ({ ...prev, prompt_text: e.target.value }))
                          }
                          placeholder="Write a summary about {{ topic }}. Make it {{ style }} and {{ length }} words long."
                          className="min-h-[100px]"
                          required
                        />
                        <p className="text-sm text-gray-500">
                          💡 Use double curly braces syntax for dynamic content from webhooks
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="webhook_url">Destination Webhook URL *</Label>
                          <Input
                            id="webhook_url"
                            type="url"
                            value={formData.destination_webhook_url}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setFormData((prev: CreatePromptInput) => ({ 
                                ...prev, 
                                destination_webhook_url: e.target.value 
                              }))
                            }
                            placeholder="https://api.example.com/webhook"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cron_schedule">CRON Schedule (Optional)</Label>
                          <Select 
                            value={formData.cron_schedule || 'manual'} 
                            onValueChange={(value: string) =>
                              setFormData((prev: CreatePromptInput) => ({ 
                                ...prev, 
                                cron_schedule: value === 'manual' ? null : value 
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Manual execution only" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual execution only</SelectItem>
                              {cronScheduleOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="text-lg font-medium">AI Model Parameters</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="temperature">Temperature</Label>
                            <Input
                              id="temperature"
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={formData.temperature}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData((prev: CreatePromptInput) => ({ 
                                  ...prev, 
                                  temperature: parseFloat(e.target.value) || 0.7 
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="max_tokens">Max Tokens</Label>
                            <Input
                              id="max_tokens"
                              type="number"
                              min="1"
                              value={formData.max_tokens || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData((prev: CreatePromptInput) => ({ 
                                  ...prev, 
                                  max_tokens: e.target.value ? parseInt(e.target.value) : null 
                                }))
                              }
                              placeholder="Auto"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="top_p">Top P</Label>
                            <Input
                              id="top_p"
                              type="number"
                              min="0"
                              max="1"
                              step="0.1"
                              value={formData.top_p}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData((prev: CreatePromptInput) => ({ 
                                  ...prev, 
                                  top_p: parseFloat(e.target.value) || 1 
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="frequency_penalty">Frequency Penalty</Label>
                            <Input
                              id="frequency_penalty"
                              type="number"
                              min="-2"
                              max="2"
                              step="0.1"
                              value={formData.frequency_penalty}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData((prev: CreatePromptInput) => ({ 
                                  ...prev, 
                                  frequency_penalty: parseFloat(e.target.value) || 0 
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="presence_penalty">Presence Penalty</Label>
                            <Input
                              id="presence_penalty"
                              type="number"
                              min="-2"
                              max="2"
                              step="0.1"
                              value={formData.presence_penalty}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setFormData((prev: CreatePromptInput) => ({ 
                                  ...prev, 
                                  presence_penalty: parseFloat(e.target.value) || 0 
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="is_active" 
                          checked={formData.is_active}
                          onCheckedChange={(checked: boolean) =>
                            setFormData((prev: CreatePromptInput) => ({ ...prev, is_active: checked }))
                          }
                        />
                        <Label htmlFor="is_active">Active</Label>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? 'Creating...' : 'Create Prompt'}
                        </Button>
                      </div>
                    </form>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>

            {prompts.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold mb-2">No prompts yet</h3>
                <p className="text-gray-500 mb-4">Create your first AI prompt to get started</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {prompts.map((prompt: Prompt) => (
                  <Card key={prompt.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{prompt.name}</CardTitle>
                          {prompt.description && (
                            <CardDescription>{prompt.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                            {prompt.is_active ? '🟢 Active' : '🔴 Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Model:</p>
                          <p className="text-sm">{prompt.model}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Schedule:</p>
                          <p className="text-sm">
                            {prompt.cron_schedule 
                              ? cronScheduleOptions.find(opt => opt.value === prompt.cron_schedule)?.label || prompt.cron_schedule
                              : '🔧 Manual only'
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Created:</p>
                          <p className="text-sm">{prompt.created_at.toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => openExecuteDialog(prompt)}
                            className="flex-1"
                          >
                            ▶️ Execute
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openEditDialog(prompt)}
                          >
                            ✏️ Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                🗑️
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Prompt</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{prompt.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePrompt(prompt.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Execution History</h2>
              <p className="text-gray-600">Track all prompt executions and their results</p>
            </div>

            {executionHistory.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">No executions yet</h3>
                <p className="text-gray-500">Execute some prompts to see their history here</p>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Webhook Status</TableHead>
                        <TableHead>Executed At</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionHistory.map((execution: ExecutionHistory) => {
                        const prompt = prompts.find((p: Prompt) => p.id === execution.prompt_id);
                        return (
                          <TableRow key={execution.id}>
                            <TableCell className="font-medium">
                              {prompt?.name || `Prompt #${execution.prompt_id}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant={execution.trigger_type === 'cron' ? 'default' : 'secondary'}>
                                {execution.trigger_type === 'cron' ? '⏰ CRON' : '🔗 Webhook'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={execution.execution_status === 'success' ? 'default' : 'destructive'}
                              >
                                {execution.execution_status === 'success' ? '✅ Success' : '❌ Failed'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {execution.webhook_response_status ? (
                                <Badge 
                                  variant={
                                    execution.webhook_response_status >= 200 && execution.webhook_response_status < 300 
                                      ? 'default' 
                                      : 'destructive'
                                  }
                                >
                                  {execution.webhook_response_status}
                                </Badge>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {execution.created_at.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {execution.error_message ? (
                                <span className="text-red-600 text-sm max-w-xs truncate block">
                                  {execution.error_message}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Prompt</DialogTitle>
              <DialogDescription>
                Update your AI prompt configuration
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <form onSubmit={handleUpdatePrompt} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Prompt Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreatePromptInput) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-model">AI Model</Label>
                    <Select 
                      value={formData.model || 'gpt-3.5-turbo'} 
                      onValueChange={(value: string) =>
                        setFormData((prev: CreatePromptInput) => ({ ...prev, model: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((model: string) => (
                          <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={formData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreatePromptInput) => ({ 
                        ...prev, 
                        description: e.target.value || null 
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-prompt-text">Prompt Text *</Label>
                  <Textarea
                    id="edit-prompt-text"
                    value={formData.prompt_text}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreatePromptInput) => ({ ...prev, prompt_text: e.target.value }))
                    }
                    className="min-h-[100px]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-webhook-url">Destination Webhook URL *</Label>
                    <Input
                      id="edit-webhook-url"
                      type="url"
                      value={formData.destination_webhook_url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreatePromptInput) => ({ 
                          ...prev, 
                          destination_webhook_url: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-cron-schedule">CRON Schedule</Label>
                    <Select 
                      value={formData.cron_schedule || 'manual'} 
                      onValueChange={(value: string) =>
                        setFormData((prev: CreatePromptInput) => ({ 
                          ...prev, 
                          cron_schedule: value === 'manual' ? null : value 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Manual execution only" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual execution only</SelectItem>
                        {cronScheduleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch 
                    id="edit-is-active" 
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) =>
                      setFormData((prev: CreatePromptInput) => ({ ...prev, is_active: checked }))
                    }
                  />
                  
                  <Label htmlFor="edit-is-active">Active</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Updating...' : 'Update Prompt'}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Execute Dialog */}
        <Dialog open={isExecuteDialogOpen} onOpenChange={setIsExecuteDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Execute Prompt: {selectedPrompt?.name}</DialogTitle>
              <DialogDescription>
                Manually execute this prompt with optional template data
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleExecutePrompt} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-data">Template Data (JSON)</Label>
                <Textarea
                  id="template-data"
                  value={executeData}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExecuteData(e.target.value)}
                  placeholder='{"topic": "AI technology", "style": "casual", "length": 100}'
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-sm text-gray-500">
                  💡 This JSON data will be used to populate template variables in your prompt
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setIsExecuteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isExecuting}>
                  {isExecuting ? '⏳ Executing...' : '▶️ Execute Prompt'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default App;
