
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_memberships": {
                  Row: {
                    "active": boolean,"app": Database["public"]['Enums']["euaggelion_app"],"created_at": string,"granted_by": string | null,"role": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"app": Database["public"]['Enums']["euaggelion_app"],"created_at"?: string,"granted_by"?: string | null,"role": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"app"?: Database["public"]['Enums']["euaggelion_app"],"created_at"?: string,"granted_by"?: string | null,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "app_memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "app_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"authors": {
                  Row: {
                    "bio": string | null,"created_at": string,"era": string | null,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"era"?: string | null,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"era"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"comment_threads": {
                  Row: {
                    "created_at": string,"created_by": string | null,"detached": boolean,"end_offset": number,"id": string,"prefix": string,"quote": string,"resolved_at": string | null,"resolved_by": string | null,"segment_id": string,"side": Database["public"]['Enums']["thread_side"],"start_offset": number,"status": Database["public"]['Enums']["thread_status"],"suffix": string,"translation_version_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"detached"?: boolean,"end_offset": number,"id"?: string,"prefix"?: string,"quote": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"segment_id": string,"side": Database["public"]['Enums']["thread_side"],"start_offset": number,"status"?: Database["public"]['Enums']["thread_status"],"suffix"?: string,"translation_version_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"detached"?: boolean,"end_offset"?: number,"id"?: string,"prefix"?: string,"quote"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"segment_id"?: string,"side"?: Database["public"]['Enums']["thread_side"],"start_offset"?: number,"status"?: Database["public"]['Enums']["thread_status"],"suffix"?: string,"translation_version_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comment_threads_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_threads_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comment_threads_segment_id_translation_version_id_fkey"
      columns: ["segment_id","translation_version_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["id","translation_version_id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"edited_at": string | null,"id": string,"mentions": (string)[],"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"mentions"?: (string)[],"thread_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"mentions"?: (string)[],"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "comment_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"glossary_terms": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"language": string,"notes": string | null,"source_term": string,"target_term": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"language": string,"notes"?: string | null,"source_term": string,"target_term": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"language"?: string,"notes"?: string | null,"source_term"?: string,"target_term"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "glossary_terms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"comment_id": string | null,"created_at": string,"emailed_at": string | null,"id": string,"kind": Database["public"]['Enums']["notification_kind"],"read_at": string | null,"thread_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["notification_kind"],"read_at"?: string | null,"thread_id": string,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["notification_kind"],"read_at"?: string | null,"thread_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "comment_threads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"segment_revisions": {
                  Row: {
                    "author_id": string | null,"created_at": string,"id": string,"model": string | null,"origin": Database["public"]['Enums']["revision_origin"],"segment_id": string,"stage": Database["public"]['Enums']["segment_stage"] | null,"text": string,"tokens": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"origin": Database["public"]['Enums']["revision_origin"],"segment_id": string,"stage"?: Database["public"]['Enums']["segment_stage"] | null,"text": string,"tokens"?: number | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"origin"?: Database["public"]['Enums']["revision_origin"],"segment_id"?: string,"stage"?: Database["public"]['Enums']["segment_stage"] | null,"text"?: string,"tokens"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "segment_revisions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segment_revisions_segment_id_fkey"
      columns: ["segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["id"]
    }
                  ]
                },"segments": {
                  Row: {
                    "created_at": string,"id": string,"position": number,"source_segment_id": string,"stage": Database["public"]['Enums']["segment_stage"],"text": string,"translation_version_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"position": number,"source_segment_id": string,"stage"?: Database["public"]['Enums']["segment_stage"],"text"?: string,"translation_version_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"position"?: number,"source_segment_id"?: string,"stage"?: Database["public"]['Enums']["segment_stage"],"text"?: string,"translation_version_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "segments_source_segment_id_fkey"
      columns: ["source_segment_id"]
isOneToOne: false
      referencedRelation: "source_segments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segments_translation_version_id_fkey"
      columns: ["translation_version_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["version_id"]
    },{
      foreignKeyName: "segments_translation_version_id_fkey"
      columns: ["translation_version_id"]
isOneToOne: false
      referencedRelation: "translation_version_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segments_translation_version_id_fkey"
      columns: ["translation_version_id"]
isOneToOne: false
      referencedRelation: "translation_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segments_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"source_segments": {
                  Row: {
                    "ast_path": string,"id": string,"kind": Database["public"]['Enums']["segment_kind"],"position": number,"source_version_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ast_path": string,"id"?: string,"kind": Database["public"]['Enums']["segment_kind"],"position": number,"source_version_id": string,"text": string
                  }
                  Update: {
                    "ast_path"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["segment_kind"],"position"?: number,"source_version_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_segments_source_version_id_fkey"
      columns: ["source_version_id"]
isOneToOne: false
      referencedRelation: "source_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"source_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"frontmatter": NonNullable<Json>,"id": string,"mdx": string,"notes": string | null,"version": number,"work_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"frontmatter"?: NonNullable<Json>,"id"?: string,"mdx": string,"notes"?: string | null,"version": number,"work_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"frontmatter"?: NonNullable<Json>,"id"?: string,"mdx"?: string,"notes"?: string | null,"version"?: number,"work_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_versions_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["work_id"]
    },{
      foreignKeyName: "source_versions_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "works"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"from_stage": Database["public"]['Enums']["segment_stage"] | null,"id": string,"segment_id": string,"to_stage": Database["public"]['Enums']["segment_stage"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"from_stage"?: Database["public"]['Enums']["segment_stage"] | null,"id"?: string,"segment_id": string,"to_stage": Database["public"]['Enums']["segment_stage"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"from_stage"?: Database["public"]['Enums']["segment_stage"] | null,"id"?: string,"segment_id"?: string,"to_stage"?: Database["public"]['Enums']["segment_stage"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_segment_id_fkey"
      columns: ["segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["id"]
    }
                  ]
                },"translation_versions": {
                  Row: {
                    "based_on_version_id": string | null,"contributors": NonNullable<Json>,"created_at": string,"created_by": string | null,"credits": string | null,"id": string,"mdx": string | null,"published_at": string | null,"reviewer_id": string | null,"source_version_id": string,"status": Database["public"]['Enums']["version_status"],"translation_id": string,"translator_id": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "based_on_version_id"?: string | null,"contributors"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"credits"?: string | null,"id"?: string,"mdx"?: string | null,"published_at"?: string | null,"reviewer_id"?: string | null,"source_version_id": string,"status"?: Database["public"]['Enums']["version_status"],"translation_id": string,"translator_id"?: string | null,"updated_at"?: string,"version": number
                  }
                  Update: {
                    "based_on_version_id"?: string | null,"contributors"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"credits"?: string | null,"id"?: string,"mdx"?: string | null,"published_at"?: string | null,"reviewer_id"?: string | null,"source_version_id"?: string,"status"?: Database["public"]['Enums']["version_status"],"translation_id"?: string,"translator_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "translation_versions_based_on_version_id_fkey"
      columns: ["based_on_version_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["version_id"]
    },{
      foreignKeyName: "translation_versions_based_on_version_id_fkey"
      columns: ["based_on_version_id"]
isOneToOne: false
      referencedRelation: "translation_version_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_based_on_version_id_fkey"
      columns: ["based_on_version_id"]
isOneToOne: false
      referencedRelation: "translation_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_source_version_id_fkey"
      columns: ["source_version_id"]
isOneToOne: false
      referencedRelation: "source_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_translation_id_fkey"
      columns: ["translation_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["translation_id"]
    },{
      foreignKeyName: "translation_versions_translation_id_fkey"
      columns: ["translation_id"]
isOneToOne: false
      referencedRelation: "translations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_translator_id_fkey"
      columns: ["translator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"translations": {
                  Row: {
                    "created_at": string,"id": string,"language": string,"published_version_id": string | null,"work_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"language": string,"published_version_id"?: string | null,"work_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"language"?: string,"published_version_id"?: string | null,"work_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "translations_published_version_fk"
      columns: ["published_version_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["version_id"]
    },{
      foreignKeyName: "translations_published_version_fk"
      columns: ["published_version_id"]
isOneToOne: false
      referencedRelation: "translation_version_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translations_published_version_fk"
      columns: ["published_version_id"]
isOneToOne: false
      referencedRelation: "translation_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translations_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["work_id"]
    },{
      foreignKeyName: "translations_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "works"
      referencedColumns: ["id"]
    }
                  ]
                },"works": {
                  Row: {
                    "author_id": string,"created_at": string,"created_by": string | null,"credits": string | null,"date_precision": Database["public"]['Enums']["date_precision"] | null,"date_text": string | null,"description": string | null,"id": string,"slug": string,"source": string | null,"status": Database["public"]['Enums']["work_status"],"title": string,"type": Database["public"]['Enums']["work_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"created_by"?: string | null,"credits"?: string | null,"date_precision"?: Database["public"]['Enums']["date_precision"] | null,"date_text"?: string | null,"description"?: string | null,"id"?: string,"slug": string,"source"?: string | null,"status"?: Database["public"]['Enums']["work_status"],"title": string,"type": Database["public"]['Enums']["work_type"],"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"created_by"?: string | null,"credits"?: string | null,"date_precision"?: Database["public"]['Enums']["date_precision"] | null,"date_text"?: string | null,"description"?: string | null,"id"?: string,"slug"?: string,"source"?: string | null,"status"?: Database["public"]['Enums']["work_status"],"title"?: string,"type"?: Database["public"]['Enums']["work_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "works_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "authors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "works_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "published_translations": {
                  Row: {
                    "author_name": string,"author_slug": string,"contributors": NonNullable<Json>,"date_precision": Database["public"]['Enums']["date_precision"] | null,"date_text": string | null,"language": string,"mdx": string | null,"original_credits": string | null,"original_description": string | null,"original_title": string,"published_at": string | null,"source": string | null,"translation_credits": string | null,"translation_id": string,"version": number,"version_id": string,"work_id": string,"work_slug": string,"work_type": Database["public"]['Enums']["work_type"]
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"translation_version_overview": {
                  Row: {
                    "can_publish": boolean | null,"created_at": string,"id": string,"is_outdated": boolean | null,"language": string,"open_source_threads": number | null,"open_target_threads": number | null,"published_at": string | null,"reviewer_id": string | null,"segments_approved": number | null,"segments_discussion": number | null,"segments_original": number | null,"segments_review": number | null,"segments_total": number | null,"segments_translation": number | null,"source_version_id": string,"status": Database["public"]['Enums']["version_status"],"translation_id": string,"translator_id": string | null,"version": number,"work_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "translation_versions_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_source_version_id_fkey"
      columns: ["source_version_id"]
isOneToOne: false
      referencedRelation: "source_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_translation_id_fkey"
      columns: ["translation_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["translation_id"]
    },{
      foreignKeyName: "translation_versions_translation_id_fkey"
      columns: ["translation_id"]
isOneToOne: false
      referencedRelation: "translations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translation_versions_translator_id_fkey"
      columns: ["translator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "translations_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "published_translations"
      referencedColumns: ["work_id"]
    },{
      foreignKeyName: "translations_work_id_fkey"
      columns: ["work_id"]
isOneToOne: false
      referencedRelation: "works"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_ai_translation":
{ Args: { "p_model": string,"p_segment_id": string,"p_text": string,"p_tokens"?: number }; Returns: {
              "created_at": string,
"id": string,
"position": number,
"source_segment_id": string,
"stage": Database["public"]['Enums']["segment_stage"],
"text": string,
"translation_version_id": string,
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "segments"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_source_version":
{ Args: { "p_frontmatter"?: Json,"p_mdx": string,"p_notes"?: string,"p_segments": Json,"p_work_id": string }; Returns: string
                           },
"create_translation_version":
{ Args: { "p_language": string,"p_mode"?: string,"p_source_version_id"?: string,"p_work_id": string }; Returns: string
                           },
"create_work":
{ Args: { "p_author_id": string,"p_credits"?: string,"p_date_precision"?: Database["public"]['Enums']["date_precision"],"p_date_text"?: string,"p_frontmatter": Json,"p_mdx": string,"p_segments": Json,"p_slug": string,"p_source"?: string,"p_type": Database["public"]['Enums']["work_type"] }; Returns: string
                           },
"publish_translation_version":
{ Args: { "p_mdx": string,"p_version_id": string }; Returns: undefined
                           },
"version_contributors":
{ Args: { "p_version_id": string }; Returns: {
              "name": string,"reviews": number,"roles": (string)[],"translations": number,"user_id": string
            }[]
                           }
          }
          Enums: {
            "date_precision": "year"|"month"|"day","euaggelion_app": "site"|"luther"|"commentary"|"reader"|"dictionary"|"chronology"|"atlas","luther_role": "admin"|"translator"|"reviewer","notification_kind": "mention"|"reply"|"thread_resolved","revision_origin": "ai"|"human","segment_kind": "title"|"description"|"heading"|"paragraph"|"list_item"|"quote"|"footnote"|"attribute","segment_stage": "original"|"translation"|"review"|"discussion"|"approved","thread_side": "source"|"target","thread_status": "open"|"resolved","version_status": "in_progress"|"published"|"archived","work_status": "draft"|"active"|"archived","work_type": "sermon"|"article"|"commentary"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "date_precision": ["year", "month", "day"],"euaggelion_app": ["site", "luther", "commentary", "reader", "dictionary", "chronology", "atlas"],"luther_role": ["admin", "translator", "reviewer"],"notification_kind": ["mention", "reply", "thread_resolved"],"revision_origin": ["ai", "human"],"segment_kind": ["title", "description", "heading", "paragraph", "list_item", "quote", "footnote", "attribute"],"segment_stage": ["original", "translation", "review", "discussion", "approved"],"thread_side": ["source", "target"],"thread_status": ["open", "resolved"],"version_status": ["in_progress", "published", "archived"],"work_status": ["draft", "active", "archived"],"work_type": ["sermon", "article", "commentary"]
          }
        }
} as const
